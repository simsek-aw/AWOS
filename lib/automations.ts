// Scheduled automations, invoked by the cron API routes (service role).
//  - runReminders(): deadline reminders, overdue escalation, stale nudges,
//    auto-archive of long-finished tasks.
//  - runDigest(): a per-employee daily digest of due/overdue/mentions.
//
// Nothing here is ever sent to a customer automatically; reminders go to the
// task's own PM/Macher (employees). Dedup markers in task_reminders stop the
// same reminder from firing twice.
import { automationEnabled, markAutomationRun } from "@/lib/agent/settings";
import { createServiceClient } from "@/lib/supabase/server";

const DONE_LABEL = "Fertig";
const STALE_DAYS = 7;
const ARCHIVE_DAYS = 30; // finished tasks older than this get archived

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function toIds(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (v) return [String(v)];
  return [];
}

type Svc = ReturnType<typeof createServiceClient>;

interface Ctx {
  svc: Svc;
  // board_id -> { pm, macher, deadline, status } column ids
  cols: Map<string, Record<string, string>>;
  // task_id -> column_id -> value
  vals: Map<string, Map<string, unknown>>;
  tasks: { id: string; board_id: string; title: string }[];
  // board_id -> set of status labels that count as "done"
  doneLabels: Map<string, Set<string>>;
}

/** Whether a status label counts as done on a board (kind:"done" or "Fertig"). */
function isDone(ctx: Ctx, boardId: string, status: string): boolean {
  const set = ctx.doneLabels.get(boardId);
  return set ? set.has(status) : status === DONE_LABEL;
}

async function buildContext(svc: Svc): Promise<Ctx> {
  const { data: cols } = await svc
    .from("columns")
    .select("id, board_id, key")
    .in("key", ["pm", "macher", "deadline", "status"])
    .returns<{ id: string; board_id: string; key: string }[]>();
  const colMap = new Map<string, Record<string, string>>();
  for (const c of cols ?? []) {
    if (!colMap.has(c.board_id)) colMap.set(c.board_id, {});
    colMap.get(c.board_id)![c.key] = c.id;
  }

  // Which status labels count as "done" per board (kind:"done" + legacy "Fertig").
  const { data: statusCols } = await svc
    .from("columns")
    .select("board_id, options")
    .eq("key", "status")
    .returns<
      { board_id: string; options: { options?: { label: string; kind?: string }[] } }[]
    >();
  const doneLabels = new Map<string, Set<string>>();
  for (const c of statusCols ?? []) {
    const set = new Set<string>([DONE_LABEL]);
    for (const o of c.options?.options ?? [])
      if (o.kind === "done") set.add(o.label);
    doneLabels.set(c.board_id, set);
  }

  const { data: tasks } = await svc
    .from("tasks")
    .select("id, board_id, title")
    .is("archived_at", null)
    .returns<{ id: string; board_id: string; title: string }[]>();

  const ids = (tasks ?? []).map((t) => t.id);
  const vals = new Map<string, Map<string, unknown>>();
  if (ids.length) {
    // Chunk to stay well under any URL length limits.
    for (let i = 0; i < ids.length; i += 200) {
      const slice = ids.slice(i, i + 200);
      const { data: rows } = await svc
        .from("task_values")
        .select("task_id, column_id, value")
        .in("task_id", slice)
        .returns<{ task_id: string; column_id: string; value: unknown }[]>();
      for (const r of rows ?? []) {
        if (!vals.has(r.task_id)) vals.set(r.task_id, new Map());
        vals.get(r.task_id)!.set(r.column_id, r.value);
      }
    }
  }

  return { svc, cols: colMap, vals, tasks: tasks ?? [], doneLabels };
}

function fieldOf(ctx: Ctx, taskId: string, boardId: string, key: string): unknown {
  const colId = ctx.cols.get(boardId)?.[key];
  if (!colId) return null;
  return ctx.vals.get(taskId)?.get(colId) ?? null;
}

async function notify(
  svc: Svc,
  rows: {
    user_id: string;
    type: string;
    task_id: string;
    board_id: string;
    body: string;
  }[],
) {
  if (rows.length) await svc.from("notifications").insert(rows);
}

/** Deadline reminders, overdue escalation, stale nudges, auto-archive. */
export async function runReminders(): Promise<{ sent: number; archived: number }> {
  const svc = createServiceClient();
  if (!(await automationEnabled(svc, "reminders"))) {
    return { sent: 0, archived: 0 };
  }
  await markAutomationRun(svc, "reminders");
  const ctx = await buildContext(svc);
  const today = ymd(new Date());
  const tomorrow = ymd(new Date(Date.now() + 86400000));

  // Existing reminder markers.
  const { data: markers } = await svc
    .from("task_reminders")
    .select("task_id, kind, ref")
    .returns<{ task_id: string; kind: string; ref: string }[]>();
  const seen = new Map<string, string>(); // `${task}:${kind}` -> ref
  for (const m of markers ?? []) seen.set(`${m.task_id}:${m.kind}`, m.ref);

  // Last activity per task (for staleness), from the activity log.
  const lastEvent = new Map<string, string>();
  const { data: evs } = await svc
    .from("task_events")
    .select("task_id, created_at")
    .order("created_at", { ascending: true })
    .returns<{ task_id: string; created_at: string }[]>();
  for (const e of evs ?? []) lastEvent.set(e.task_id, e.created_at); // last wins

  let sent = 0;
  let archived = 0;
  const notifRows: Parameters<typeof notify>[1] = [];
  const markerUpserts: { task_id: string; kind: string; ref: string }[] = [];

  const archiveBefore = Date.now() - ARCHIVE_DAYS * 86400000;
  const staleBefore = Date.now() - STALE_DAYS * 86400000;

  for (const t of ctx.tasks) {
    const status = fieldOf(ctx, t.id, t.board_id, "status");
    const done = isDone(ctx, t.board_id, String(status ?? ""));
    const deadline = fieldOf(ctx, t.id, t.board_id, "deadline");
    const dl = deadline ? String(deadline).slice(0, 10) : "";
    const assignees = [
      ...toIds(fieldOf(ctx, t.id, t.board_id, "pm")),
      ...toIds(fieldOf(ctx, t.id, t.board_id, "macher")),
    ];
    const recipients = [...new Set(assignees)];

    const pushReminder = (kind: string, ref: string, body: string) => {
      if (seen.get(`${t.id}:${kind}`) === ref) return; // already sent for this ref
      markerUpserts.push({ task_id: t.id, kind, ref });
      for (const uid of recipients) {
        notifRows.push({
          user_id: uid,
          type: kind,
          task_id: t.id,
          board_id: t.board_id,
          body,
        });
      }
      sent += recipients.length;
    };

    if (!done && dl && recipients.length) {
      if (dl < today) {
        pushReminder("overdue", dl, `Überfällig: „${t.title}" (Deadline ${dl}).`);
      } else if (dl === today || dl === tomorrow) {
        pushReminder(
          "due_soon",
          dl,
          `Bald fällig: „${t.title}" (Deadline ${dl}).`,
        );
      }
    }

    // Stale: open task with no activity for STALE_DAYS. Re-nudge each new week.
    if (!done && recipients.length) {
      const last = lastEvent.get(t.id);
      const lastMs = last ? new Date(last).getTime() : 0;
      if (lastMs && lastMs < staleBefore) {
        const weeks = Math.floor((Date.now() - lastMs) / (7 * 86400000));
        pushReminder(
          "stale",
          `w${weeks}`,
          `Keine Aktivität seit ${Math.floor((Date.now() - lastMs) / 86400000)} Tagen: „${t.title}".`,
        );
      }
    }

    // Auto-archive: finished and untouched for a while.
    if (done) {
      const last = lastEvent.get(t.id);
      const lastMs = last ? new Date(last).getTime() : 0;
      if (lastMs && lastMs < archiveBefore) {
        await svc
          .from("tasks")
          .update({ archived_at: new Date().toISOString() })
          .eq("id", t.id);
        archived++;
      }
    }
  }

  await notify(svc, notifRows);
  for (const m of markerUpserts) {
    await svc.from("task_reminders").upsert(m, { onConflict: "task_id,kind" });
  }

  return { sent, archived };
}

/**
 * Per-board health digest (daily): overdue / unassigned / stalled counts sent
 * to the employees actually involved in that board (its PM/Macher). Only sent
 * when there's something actionable.
 */
export async function runBoardHealth(): Promise<{ boards: number }> {
  const svc = createServiceClient();
  if (!(await automationEnabled(svc, "digest"))) return { boards: 0 };
  const ctx = await buildContext(svc);
  const today = ymd(new Date());
  const tomorrow = ymd(new Date(Date.now() + 86400000));
  const staleBefore = Date.now() - STALE_DAYS * 86400000;

  const { data: boards } = await svc
    .from("boards")
    .select("id, name")
    .returns<{ id: string; name: string }[]>();

  const lastEvent = new Map<string, string>();
  const { data: evs } = await svc
    .from("task_events")
    .select("task_id, created_at")
    .order("created_at", { ascending: true })
    .returns<{ task_id: string; created_at: string }[]>();
  for (const e of evs ?? []) lastEvent.set(e.task_id, e.created_at);

  const tasksByBoard = new Map<string, typeof ctx.tasks>();
  for (const t of ctx.tasks) {
    if (!tasksByBoard.has(t.board_id)) tasksByBoard.set(t.board_id, []);
    tasksByBoard.get(t.board_id)!.push(t);
  }

  let sentBoards = 0;
  for (const b of boards ?? []) {
    const list = tasksByBoard.get(b.id) ?? [];
    if (list.length === 0) continue;

    let overdue = 0;
    let dueSoon = 0;
    let unassigned = 0;
    let stalled = 0;
    const involved = new Set<string>();

    for (const t of list) {
      const status = String(fieldOf(ctx, t.id, b.id, "status") ?? "");
      if (isDone(ctx, b.id, status)) continue;
      const dl = String(fieldOf(ctx, t.id, b.id, "deadline") ?? "").slice(0, 10);
      const assignees = [
        ...toIds(fieldOf(ctx, t.id, b.id, "pm")),
        ...toIds(fieldOf(ctx, t.id, b.id, "macher")),
      ];
      for (const a of assignees) involved.add(a);

      if (dl && dl < today) overdue++;
      else if (dl && (dl === today || dl === tomorrow)) dueSoon++;
      if (toIds(fieldOf(ctx, t.id, b.id, "macher")).length === 0) unassigned++;
      const last = lastEvent.get(t.id);
      if (last && new Date(last).getTime() < staleBefore) stalled++;
    }

    if (overdue === 0 && unassigned === 0 && stalled === 0) continue;

    const parts: string[] = [];
    if (overdue) parts.push(`${overdue} überfällig`);
    if (dueSoon) parts.push(`${dueSoon} bald fällig`);
    if (unassigned) parts.push(`${unassigned} ohne Macher`);
    if (stalled) parts.push(`${stalled} inaktiv`);
    const body = `Board „${b.name}": ${parts.join(" · ")}.`;

    const recipients = [...involved];
    if (recipients.length === 0) continue;
    await svc.from("notifications").insert(
      recipients.map((uid) => ({
        user_id: uid,
        type: "board_health",
        task_id: null,
        board_id: b.id,
        body,
      })),
    );
    sentBoards++;
  }

  return { boards: sentBoards };
}

/** Per-employee daily digest: open tasks due today / overdue + unread mentions. */
export async function runDigest(): Promise<{ users: number }> {
  const svc = createServiceClient();
  if (!(await automationEnabled(svc, "digest"))) return { users: 0 };
  await markAutomationRun(svc, "digest");
  const ctx = await buildContext(svc);
  const today = ymd(new Date());

  const { data: employees } = await svc
    .from("profiles")
    .select("id, full_name")
    .eq("role", "employee")
    .returns<{ id: string; full_name: string | null }[]>();

  // Build per-user buckets.
  const due = new Map<string, string[]>(); // uid -> titles due today
  const overdue = new Map<string, string[]>();
  for (const t of ctx.tasks) {
    const status = String(fieldOf(ctx, t.id, t.board_id, "status") ?? "");
    if (isDone(ctx, t.board_id, status)) continue;
    const dl = String(fieldOf(ctx, t.id, t.board_id, "deadline") ?? "").slice(0, 10);
    if (!dl) continue;
    const assignees = new Set([
      ...toIds(fieldOf(ctx, t.id, t.board_id, "pm")),
      ...toIds(fieldOf(ctx, t.id, t.board_id, "macher")),
    ]);
    const bucket = dl < today ? overdue : dl === today ? due : null;
    if (!bucket) continue;
    for (const uid of assignees) {
      if (!bucket.has(uid)) bucket.set(uid, []);
      bucket.get(uid)!.push(t.title);
    }
  }

  let users = 0;
  for (const e of employees ?? []) {
    const d = due.get(e.id) ?? [];
    const o = overdue.get(e.id) ?? [];
    const { count: unread } = await svc
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", e.id)
      .eq("read", false);
    if (d.length === 0 && o.length === 0 && !unread) continue;

    const parts: string[] = [];
    if (o.length) parts.push(`${o.length} überfällig`);
    if (d.length) parts.push(`${d.length} heute fällig`);
    if (unread) parts.push(`${unread} ungelesen`);
    await svc.from("notifications").insert({
      user_id: e.id,
      type: "digest",
      task_id: null,
      board_id: null,
      body: `Tagesüberblick: ${parts.join(" · ")}.`,
    });
    users++;
  }

  return { users };
}
