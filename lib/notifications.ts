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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Notify a user that they were set as "Macher" on a task. */
export async function notifyAssignment(opts: {
  boardId: string;
  taskId: string;
  assigneeId: string;
  actorId: string | null;
}) {
  const { boardId, taskId, assigneeId, actorId } = opts;
  if (!assigneeId || !UUID_RE.test(assigneeId) || assigneeId === actorId) return;

  const svc = createServiceClient();
  const [{ data: board }, { data: assignee }, { data: task }] =
    await Promise.all([
      svc.from("boards").select("type, customer_id").eq("id", boardId).single(),
      svc
        .from("profiles")
        .select("id, full_name, role, customer_id")
        .eq("id", assigneeId)
        .single(),
      svc.from("tasks").select("title").eq("id", taskId).single(),
    ]);
  if (!board || !assignee) return;
  if (!canAccessBoard(assignee as ProfileLite, board as BoardLite)) return;

  await svc.from("notifications").insert({
    user_id: assigneeId,
    type: "assignment",
    task_id: taskId,
    board_id: boardId,
    actor_id: actorId,
    body: `Du wurdest als Macher eingetragen: „${task?.title ?? "Task"}".`,
  });
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
  const [{ data: board }, { data: profiles }, { data: task }] =
    await Promise.all([
      svc.from("boards").select("type, customer_id").eq("id", boardId).single(),
      svc.from("profiles").select("id, full_name, role, customer_id"),
      svc.from("tasks").select("title").eq("id", taskId).single(),
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
  const rows = recipients.map((p) => ({
    user_id: p.id,
    type: "mention",
    task_id: taskId,
    board_id: boardId,
    actor_id: actorId,
    body: `Erwähnt in „${task?.title ?? "Task"}": ${preview}`,
  }));
  await svc.from("notifications").insert(rows);
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
