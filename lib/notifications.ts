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

/**
 * Notify the people involved in a task when a new comment/reply is posted:
 * its PM/Macher, everyone who already commented (thread participants), the
 * parent comment's author (for replies) and the task creator. Excludes the
 * actor and anyone already @-mentioned (they get a mention notification).
 */
export async function notifyComment(opts: {
  boardId: string;
  taskId: string;
  actorId: string | null;
  body: string;
  parentId?: string | null;
  commentId?: string | null;
}) {
  const { boardId, taskId, actorId, body, parentId, commentId } = opts;
  const svc = createServiceClient();

  const [{ data: board }, { data: task }, from] = await Promise.all([
    svc.from("boards").select("type, customer_id").eq("id", boardId).single(),
    svc.from("tasks").select("title, created_by").eq("id", taskId).single(),
    actorName(svc, actorId),
  ]);
  if (!board) return;

  const recipientIds = new Set<string>();

  // PM / Macher assignees of this task.
  const { data: personCols } = await svc
    .from("columns")
    .select("id")
    .eq("board_id", boardId)
    .in("key", ["pm", "macher"])
    .returns<{ id: string }[]>();
  const colIds = (personCols ?? []).map((c) => c.id);
  if (colIds.length) {
    const { data: vals } = await svc
      .from("task_values")
      .select("value")
      .eq("task_id", taskId)
      .in("column_id", colIds)
      .returns<{ value: unknown }[]>();
    for (const v of vals ?? []) {
      const arr = Array.isArray(v.value) ? v.value : v.value ? [v.value] : [];
      for (const id of arr) recipientIds.add(String(id));
    }
  }

  // Thread participants (everyone who already commented on this task).
  const { data: prior } = await svc
    .from("comments")
    .select("author_id")
    .eq("task_id", taskId)
    .returns<{ author_id: string | null }[]>();
  for (const c of prior ?? []) if (c.author_id) recipientIds.add(c.author_id);

  // Parent comment author (reply).
  if (parentId) {
    const { data: parent } = await svc
      .from("comments")
      .select("author_id")
      .eq("id", parentId)
      .maybeSingle<{ author_id: string | null }>();
    if (parent?.author_id) recipientIds.add(parent.author_id);
  }

  if (task?.created_by) recipientIds.add(task.created_by);
  if (actorId) recipientIds.delete(actorId);
  if (recipientIds.size === 0) return;

  // Resolve profiles, drop those without board access or already @-mentioned.
  const { data: profiles } = await svc
    .from("profiles")
    .select("id, full_name, role, customer_id")
    .in("id", [...recipientIds])
    .returns<ProfileLite[]>();
  const recipients = (profiles ?? []).filter(
    (p) => canAccessBoard(p, board as BoardLite) && !isMentioned(body, p),
  );
  if (recipients.length === 0) return;

  const preview = body.length > 140 ? body.slice(0, 140) + "…" : body;
  const title = task?.title ?? "Task";
  const by = from ? `${from} ` : "";
  const verb = parentId ? "hat geantwortet" : "hat kommentiert";
  await svc.from("notifications").insert(
    recipients.map((p) => ({
      user_id: p.id,
      type: "comment",
      task_id: taskId,
      board_id: boardId,
      comment_id: commentId ?? null,
      actor_id: actorId,
      body: `${by}${verb} in „${title}": ${preview}`,
    })),
  );

  const url = taskUrl(boardId, taskId);
  await Promise.all(
    recipients.map(async (p) => {
      const email = await emailForUser(svc, p.id);
      if (email) {
        await sendEmail(
          email,
          `AWOS: Neuer Kommentar in „${title}"`,
          `${by}${verb}:\n\n${preview}\n\n${url}`,
        );
      }
    }),
  );
}

/** Notify a task's PM/Macher that its status changed. */
export async function notifyStatusChange(opts: {
  boardId: string;
  taskId: string;
  actorId: string | null;
  status: string;
}) {
  const { boardId, taskId, actorId, status } = opts;
  const svc = createServiceClient();

  const { data: personCols } = await svc
    .from("columns")
    .select("id")
    .eq("board_id", boardId)
    .in("key", ["pm", "macher"])
    .returns<{ id: string }[]>();
  const colIds = (personCols ?? []).map((c) => c.id);
  if (!colIds.length) return;

  const { data: vals } = await svc
    .from("task_values")
    .select("value")
    .eq("task_id", taskId)
    .in("column_id", colIds)
    .returns<{ value: unknown }[]>();
  const ids = new Set<string>();
  for (const v of vals ?? []) {
    const arr = Array.isArray(v.value) ? v.value : v.value ? [v.value] : [];
    for (const id of arr) ids.add(String(id));
  }
  if (actorId) ids.delete(actorId);
  if (ids.size === 0) return;

  const [{ data: task }, from] = await Promise.all([
    svc.from("tasks").select("title").eq("id", taskId).single(),
    actorName(svc, actorId),
  ]);
  const by = from ? ` (${from})` : "";
  await svc.from("notifications").insert(
    [...ids].map((uid) => ({
      user_id: uid,
      type: "status",
      task_id: taskId,
      board_id: boardId,
      actor_id: actorId,
      body: `Status „${status}"${by}: „${task?.title ?? "Task"}".`,
    })),
  );
}

/** Notify a comment's author that someone reacted (liked) their comment. */
export async function notifyReaction(opts: {
  boardId: string;
  taskId: string;
  commentId: string;
  actorId: string | null;
}) {
  const { boardId, taskId, commentId, actorId } = opts;
  const svc = createServiceClient();

  const { data: comment } = await svc
    .from("comments")
    .select("author_id")
    .eq("id", commentId)
    .maybeSingle<{ author_id: string | null }>();
  if (!comment?.author_id || comment.author_id === actorId) return;

  const [{ data: board }, { data: recipient }, { data: task }, from] =
    await Promise.all([
      svc.from("boards").select("type, customer_id").eq("id", boardId).single(),
      svc
        .from("profiles")
        .select("id, full_name, role, customer_id")
        .eq("id", comment.author_id)
        .single(),
      svc.from("tasks").select("title").eq("id", taskId).single(),
      actorName(svc, actorId),
    ]);
  if (!board || !recipient) return;
  if (!canAccessBoard(recipient as ProfileLite, board as BoardLite)) return;

  const by = from ? `${from} ` : "Jemand ";
  const body = `${by}gefällt dein Kommentar in „${task?.title ?? "Task"}".`;
  await svc.from("notifications").insert({
    user_id: comment.author_id,
    type: "reaction",
    task_id: taskId,
    board_id: boardId,
    comment_id: commentId,
    actor_id: actorId,
    body,
  });
}

/** Notify every accessible user @-mentioned in a comment body. */
export async function notifyMentions(opts: {
  boardId: string;
  taskId: string;
  body: string;
  actorId: string | null;
  commentId?: string | null;
}) {
  const { boardId, taskId, body, actorId, commentId } = opts;
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
    comment_id: commentId ?? null,
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
