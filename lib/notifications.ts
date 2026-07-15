// Server-side notification creation. Uses the service client (bypasses RLS)
// because a notification is written for ANOTHER user. We only ever notify users
// who can actually access the board, so a notification never leaks a task to
// someone who couldn't otherwise see it.
import { createServiceClient } from "@/lib/supabase/server";

interface ProfileLite {
  id: string;
  full_name: string | null;
  role: "employee" | "customer";
  customer_id: string | null;
}
interface BoardLite {
  type: "customer" | "internal";
  customer_id: string | null;
}

function canAccessBoard(p: ProfileLite, board: BoardLite): boolean {
  if (p.role === "employee") return true;
  return board.type === "customer" && p.customer_id === board.customer_id;
}

function taskUrl(boardId: string, taskId: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  return `${base}/boards/${boardId}/tasks/${taskId}`;
}

/**
 * Send a transactional email via Resend. No-op unless RESEND_API_KEY and
 * EMAIL_FROM are configured, so email is purely additive to the in-app bell.
 */
async function sendEmail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text }),
    });
  } catch (e) {
    console.error("sendEmail failed:", e);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function emailForUser(svc: any, userId: string): Promise<string | null> {
  try {
    const { data } = await svc.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function actorName(svc: any, actorId: string | null): Promise<string | null> {
  if (!actorId) return null;
  const { data } = await svc
    .from("profiles")
    .select("full_name")
    .eq("id", actorId)
    .maybeSingle();
  return data?.full_name ?? null;
}

/** Notify a user that they were set as PM/Macher on a task (roleLabel says which). */
export async function notifyAssignment(opts: {
  boardId: string;
  taskId: string;
  assigneeId: string;
  actorId: string | null;
  roleLabel?: string;
}) {
  const { boardId, taskId, assigneeId, actorId } = opts;
  const roleLabel = opts.roleLabel ?? "Macher";
  if (!assigneeId || !UUID_RE.test(assigneeId) || assigneeId === actorId) return;

  const svc = createServiceClient();
  const [{ data: board }, { data: assignee }, { data: task }, from] =
    await Promise.all([
      svc.from("boards").select("type, customer_id").eq("id", boardId).single(),
      svc
        .from("profiles")
        .select("id, full_name, role, customer_id")
        .eq("id", assigneeId)
        .single(),
      svc.from("tasks").select("title").eq("id", taskId).single(),
      actorName(svc, actorId),
    ]);
  if (!board || !assignee) return;
  if (!canAccessBoard(assignee as ProfileLite, board as BoardLite)) return;

  const by = from ? ` von ${from}` : "";
  const body = `Du wurdest als ${roleLabel} eingetragen${by}: „${task?.title ?? "Task"}".`;
  await svc.from("notifications").insert({
    user_id: assigneeId,
    type: "assignment",
    task_id: taskId,
    board_id: boardId,
    actor_id: actorId,
    body,
  });

  const email = await emailForUser(svc, assigneeId);
  if (email) {
    await sendEmail(
      email,
      "AWOS: Neue Aufgabe für dich",
      `${body}\n\n${taskUrl(boardId, taskId)}`,
    );
  }
}

/**
 * Notify the members of an internal board's department that a new task landed
 * there (e.g. a mirrored customer task). Employees without a matching
 * department are not notified.
 */
export async function notifyNewInternalTask(opts: {
  boardId: string;
  taskId: string;
  actorId: string | null;
}) {
  const { boardId, taskId, actorId } = opts;
  const svc = createServiceClient();
  const [{ data: board }, { data: task }] = await Promise.all([
    svc.from("boards").select("type, department").eq("id", boardId).single(),
    svc.from("tasks").select("title").eq("id", taskId).single(),
  ]);
  if (!board || board.type !== "internal") return;

  // Recipients: employees in this board's department (or all employees if the
  // board has no department set). Never the actor.
  let query = svc.from("profiles").select("id").eq("role", "employee");
  if (board.department) query = query.eq("department", board.department);
  const { data: recips } = await query.returns<{ id: string }[]>();
  const recipients = (recips ?? []).filter((r) => r.id !== actorId);
  if (recipients.length === 0) return;

  const body = `Neue Aufgabe im internen Board: „${task?.title ?? "Task"}".`;
  await svc.from("notifications").insert(
    recipients.map((r) => ({
      user_id: r.id,
      type: "new_task",
      task_id: taskId,
      board_id: boardId,
      actor_id: actorId,
      body,
    })),
  );
}

/** Notify every accessible user @-mentioned in a comment body. */
export async function notifyMentions(opts: {
  boardId: string;
  taskId: string;
  body: string;
  actorId: string | null;
}) {
  const { boardId, taskId, body, actorId } = opts;
  if (!body.includes("@")) return;

  const svc = createServiceClient();
  const [{ data: board }, { data: profiles }, { data: task }, from] =
    await Promise.all([
      svc.from("boards").select("type, customer_id").eq("id", boardId).single(),
      svc.from("profiles").select("id, full_name, role, customer_id"),
      svc.from("tasks").select("title").eq("id", taskId).single(),
      actorName(svc, actorId),
    ]);
  if (!board || !profiles) return;

  const recipients = (profiles as ProfileLite[]).filter(
    (p) =>
      p.id !== actorId &&
      isMentioned(body, p) &&
      canAccessBoard(p, board as BoardLite),
  );
  if (recipients.length === 0) return;

  const preview = body.length > 140 ? body.slice(0, 140) + "…" : body;
  const title = task?.title ?? "Task";
  const by = from ? ` von ${from}` : "";
  const rows = recipients.map((p) => ({
    user_id: p.id,
    type: "mention",
    task_id: taskId,
    board_id: boardId,
    actor_id: actorId,
    body: `Erwähnt${by} in „${title}": ${preview}`,
  }));
  await svc.from("notifications").insert(rows);

  const url = taskUrl(boardId, taskId);
  await Promise.all(
    recipients.map(async (p) => {
      const email = await emailForUser(svc, p.id);
      if (email) {
        await sendEmail(
          email,
          `AWOS: Erwähnung in „${title}"`,
          `Du wurdest in einem Kommentar erwähnt:\n\n${preview}\n\n${url}`,
        );
      }
    }),
  );
}

function isMentioned(body: string, p: ProfileLite): boolean {
  if (!p.full_name) return false;
  const b = body.toLowerCase();
  const full = p.full_name.toLowerCase().trim();
  const candidates = [full, full.replace(/\s+/g, ""), full.split(/\s+/)[0]].filter(
    (c) => c.length >= 2,
  );
  return candidates.some((c) => b.includes("@" + c));
}
