"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { generateCreatives } from "@/lib/agent/creative";
import {
  propagateFieldAcrossMirror,
  propagateTitleAcrossMirror,
  syncMirrorForCustomerTask,
} from "@/lib/agent/mirror";
import { draftCustomerReply } from "@/lib/agent/reply";
import { refreshGroupSummaries } from "@/lib/agent/summary";
import { suggestTriage } from "@/lib/agent/triage";
import { requireEmployee, requireSession } from "@/lib/auth";
import {
  notifyAssignment,
  notifyComment,
  notifyMentions,
  notifyNewInternalTask,
  notifyReaction,
  notifyStatusChange,
} from "@/lib/notifications";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

const BUCKET = "attachments";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Append a line to a task's activity log. Fire-and-forget (service role). */
async function logTaskEvent(
  taskId: string,
  actorId: string | null,
  kind: string,
  summary: string,
) {
  try {
    const svc = createServiceClient();
    await svc
      .from("task_events")
      .insert({ task_id: taskId, actor_id: actorId, kind, summary });
  } catch (e) {
    console.error("logTaskEvent failed:", e);
  }
}

/** Create a task in a group. RLS ensures the caller may write to this board. */
export async function createTask(
  boardId: string,
  groupId: string,
  formData: FormData,
) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const ctx = await requireSession();
  const supabase = await createServerSupabase();
  const { data: task } = await supabase
    .from("tasks")
    .insert({ board_id: boardId, group_id: groupId, title })
    .select("id")
    .single<{ id: string }>();

  // Seed default column values on the new task.
  if (task) {
    const { data: cols } = await supabase
      .from("columns")
      .select("id, key, options")
      .eq("board_id", boardId)
      .in("key", ["status", "pm"])
      .returns<
        { id: string; key: string; options: { options?: { label: string }[] } }[]
      >();
    const statusCol = cols?.find((c) => c.key === "status");
    const pmCol = cols?.find((c) => c.key === "pm");

    const seedRows: { task_id: string; column_id: string; value: unknown }[] = [];
    // A new task should never have an empty status — default it to the status
    // column's first option (usually "Offen").
    if (statusCol) {
      const firstLabel = statusCol.options?.options?.[0]?.label ?? "Offen";
      seedRows.push({ task_id: task.id, column_id: statusCol.id, value: firstLabel });
    }
    // Pre-select the creator as PM (saves a click). Only for employees — a PM
    // is an agency project manager, so a customer creating a task is left
    // unassigned for the team to pick up.
    if (pmCol && ctx.profile.role === "employee") {
      seedRows.push({ task_id: task.id, column_id: pmCol.id, value: [ctx.userId] });
    }
    if (seedRows.length) {
      await supabase.from("task_values").insert(seedRows);
    }
  }

  // Notify the internal board's department that a new task landed. (Mirrored
  // customer tasks are notified from the mirror agent.) Mirroring itself is NOT
  // triggered on creation — it fires on the customer's first comment.
  if (task) {
    const actorId = ctx.userId;
    after(() => notifyNewInternalTask({ boardId, taskId: task.id, actorId }));
    after(() => logTaskEvent(task.id, actorId, "created", "Task erstellt"));
  }
  revalidatePath(`/boards/${boardId}`);
}

/** Create a new group on a board. */
export async function createGroup(boardId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim() || "Neue Gruppe";
  const supabase = await createServerSupabase();
  const { data: last } = await supabase
    .from("groups")
    .select("position")
    .eq("board_id", boardId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle<{ position: number }>();
  const position = (last?.position ?? -1) + 1;
  const { error } = await supabase
    .from("groups")
    .insert({ board_id: boardId, name, position });
  if (error) {
    console.error("createGroup failed", { boardId, error });
    throw new Error(`Gruppe konnte nicht erstellt werden: ${error.message}`);
  }
  revalidatePath(`/boards/${boardId}`);
}

/** Rename a group (one-click edit). */
export async function renameGroup(
  boardId: string,
  groupId: string,
  name: string,
) {
  const n = name.trim();
  if (!n) return;
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("groups")
    .update({ name: n })
    .eq("id", groupId);
  if (error) {
    console.error("renameGroup failed", { boardId, groupId, error });
    throw new Error(`Gruppe konnte nicht umbenannt werden: ${error.message}`);
  }
  revalidatePath(`/boards/${boardId}`);
}

/** Delete a group; its tasks move to another group (never orphaned). */
export async function deleteGroup(boardId: string, groupId: string) {
  const supabase = await createServerSupabase();
  const { data: others } = await supabase
    .from("groups")
    .select("id")
    .eq("board_id", boardId)
    .neq("id", groupId)
    .order("position", { ascending: true })
    .returns<{ id: string }[]>();
  if (!others || others.length === 0) return; // never delete the last group
  const { error: moveError } = await supabase
    .from("tasks")
    .update({ group_id: others[0].id })
    .eq("group_id", groupId);
  if (moveError) {
    console.error("deleteGroup: moving tasks failed", { boardId, groupId, moveError });
    throw new Error(`Tasks konnten nicht verschoben werden: ${moveError.message}`);
  }
  const { error: delError } = await supabase.from("groups").delete().eq("id", groupId);
  if (delError) {
    console.error("deleteGroup failed", { boardId, groupId, delError });
    throw new Error(`Gruppe konnte nicht gelöscht werden: ${delError.message}`);
  }
  revalidatePath(`/boards/${boardId}`);
}

/** Move a task to another group (drag & drop between groups). */
export async function moveTask(
  boardId: string,
  taskId: string,
  groupId: string,
) {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("tasks")
    .update({ group_id: groupId })
    .eq("id", taskId);
  if (error) {
    console.error("moveTask failed", { boardId, taskId, groupId, error });
    throw new Error(`Task konnte nicht verschoben werden: ${error.message}`);
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: g } = await supabase
    .from("groups")
    .select("name")
    .eq("id", groupId)
    .maybeSingle<{ name: string }>();
  after(() =>
    logTaskEvent(
      taskId,
      user?.id ?? null,
      "moved",
      `In Gruppe „${g?.name ?? "?"}" verschoben`,
    ),
  );
  revalidatePath(`/boards/${boardId}`);
}

/**
 * Duplicate a task within its board. withValues=true copies all column values
 * (PM, Macher, Status, Deadline, …); false creates a bare copy with just the
 * title. Comments, attachments and mirror links are never copied.
 */
export async function duplicateTask(
  boardId: string,
  taskId: string,
  withValues: boolean,
) {
  const supabase = await createServerSupabase();

  const { data: src } = await supabase
    .from("tasks")
    .select("title, group_id")
    .eq("id", taskId)
    .single<{ title: string; group_id: string | null }>();
  if (!src) return;

  const { data: copy } = await supabase
    .from("tasks")
    .insert({
      board_id: boardId,
      group_id: src.group_id,
      title: `${src.title} (Kopie)`,
    })
    .select("id")
    .single<{ id: string }>();
  if (!copy) return;

  if (withValues) {
    const { data: vals } = await supabase
      .from("task_values")
      .select("column_id, value")
      .eq("task_id", taskId)
      .returns<{ column_id: string; value: unknown }[]>();
    if (vals && vals.length) {
      await supabase.from("task_values").insert(
        vals.map((v) => ({
          task_id: copy.id,
          column_id: v.column_id,
          value: v.value,
        })),
      );
    }
  }

  revalidatePath(`/boards/${boardId}`);
}

/** Inline: rename a task (the "Name" column). */
export async function renameTask(
  boardId: string,
  taskId: string,
  title: string,
) {
  const t = title.trim();
  if (!t) return;
  const supabase = await createServerSupabase();
  await supabase.from("tasks").update({ title: t }).eq("id", taskId);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  after(() => propagateTitleAcrossMirror(taskId, t));
  after(() =>
    logTaskEvent(taskId, user?.id ?? null, "renamed", `Umbenannt in „${t}"`),
  );
  revalidatePath(`/boards/${boardId}`);
  revalidatePath(`/boards/${boardId}/tasks/${taskId}`);
}

/** Inline: set a single column value on a task. */
export async function setCellValue(
  boardId: string,
  taskId: string,
  columnId: string,
  columnKey: string,
  value: string,
) {
  const v = value.trim() === "" ? null : value;
  const supabase = await createServerSupabase();
  await supabase
    .from("task_values")
    .upsert(
      { task_id: taskId, column_id: columnId, value: v },
      { onConflict: "task_id,column_id" },
    );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const actorId = user?.id ?? null;
  // Notify the newly assigned "Macher" (person column). RLS-safe: notifyAssignment
  // only notifies users who can access this board.
  if (columnKey === "macher" && v) {
    after(() =>
      notifyAssignment({ boardId, taskId, assigneeId: v, actorId }),
    );
  }

  // Status automations: notify the task's PM/Macher, auto-move a finished task
  // into a "Done"/"Fertig" group if the board has one, and (for a mirrored
  // internal task marked done) draft a customer reply for review.
  if (columnKey === "status" && v) {
    after(() => notifyStatusChange({ boardId, taskId, actorId, status: v }));
    if (v === "Fertig") {
      const { data: doneGroup } = await supabase
        .from("groups")
        .select("id, name")
        .eq("board_id", boardId)
        .returns<{ id: string; name: string }[]>();
      const target = (doneGroup ?? []).find((g) =>
        /fertig|done|erledigt|archiv/i.test(g.name),
      );
      if (target) {
        await supabase
          .from("tasks")
          .update({ group_id: target.id })
          .eq("id", taskId);
      }
      after(() => draftCustomerReply(taskId));
    }
  }

  // Mirror this field across the task's mirror group (customer ↔ internal,
  // both directions). No-op if the task isn't mirrored.
  after(() => propagateFieldAcrossMirror(taskId, columnKey));

  after(() =>
    logTaskEvent(
      taskId,
      actorId,
      "changed",
      v ? `„${columnKey}" auf „${v}" gesetzt` : `„${columnKey}" geleert`,
    ),
  );

  revalidatePath(`/boards/${boardId}`);
  revalidatePath(`/boards/${boardId}/tasks/${taskId}`);
}

/** Inline: set the assigned people (array) on a person column (PM/Macher). */
export async function setPeople(
  boardId: string,
  taskId: string,
  columnId: string,
  columnKey: string,
  ids: string[],
) {
  const clean = Array.from(new Set(ids.filter(Boolean)));
  const supabase = await createServerSupabase();

  // For PM and Macher, figure out who is newly added so we only notify them.
  const notifyRole = columnKey === "macher" || columnKey === "pm";
  let added: string[] = [];
  if (notifyRole) {
    const { data: existing } = await supabase
      .from("task_values")
      .select("value")
      .eq("task_id", taskId)
      .eq("column_id", columnId)
      .maybeSingle<{ value: unknown }>();
    const old = Array.isArray(existing?.value)
      ? existing!.value.map(String)
      : existing?.value
        ? [String(existing.value)]
        : [];
    added = clean.filter((id) => !old.includes(id));
  }

  await supabase
    .from("task_values")
    .upsert(
      { task_id: taskId, column_id: columnId, value: clean.length ? clean : null },
      { onConflict: "task_id,column_id" },
    );

  if (added.length) {
    const roleLabel = columnKey === "pm" ? "PM" : "Macher";
    const {
      data: { user },
    } = await supabase.auth.getUser();
    after(() =>
      Promise.all(
        added.map((assigneeId) =>
          notifyAssignment({
            boardId,
            taskId,
            assigneeId,
            actorId: user?.id ?? null,
            roleLabel,
          }),
        ),
      ),
    );
  }

  // Tagging a PM/Macher is what routes a customer task to the internal
  // department board(s). Re-sync the mirror (no-op on internal boards) and
  // push the new assignment down to existing internal copies.
  if (notifyRole) {
    after(() => syncMirrorForCustomerTask(taskId));
  }
  after(() => propagateFieldAcrossMirror(taskId, columnKey));

  {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const roleLabel =
      columnKey === "pm" ? "PM" : columnKey === "macher" ? "Macher" : columnKey;
    after(() =>
      logTaskEvent(
        taskId,
        user?.id ?? null,
        "assigned",
        `${roleLabel} aktualisiert (${clean.length})`,
      ),
    );
  }

  revalidatePath(`/boards/${boardId}`);
  revalidatePath(`/boards/${boardId}/tasks/${taskId}`);
}

/**
 * Employee-only: set (or clear) the manual customer tag on an internally-created
 * task. Purely organisational — this does NOT mirror the task anywhere or sync
 * to the customer's board; internal tasks always stay internal.
 */
export async function setTaskCustomer(
  boardId: string,
  taskId: string,
  customerId: string | null,
) {
  await requireEmployee();
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("tasks")
    .update({ customer_id: customerId })
    .eq("id", taskId);
  if (error) {
    console.error("setTaskCustomer failed", { boardId, taskId, error });
    throw new Error(`Kunde konnte nicht gesetzt werden: ${error.message}`);
  }
  revalidatePath(`/boards/${boardId}`);
}

/** Employee-only: edit a status column's labels & colors. */
export async function updateColumnOptions(
  boardId: string,
  columnId: string,
  options: { label: string; color: string }[],
) {
  await requireEmployee();
  const clean = options
    .map((o) => ({ label: o.label.trim(), color: o.color }))
    .filter((o) => o.label.length > 0);
  const supabase = await createServerSupabase();
  await supabase
    .from("columns")
    .update({ options: { options: clean } })
    .eq("id", columnId);
  revalidatePath(`/boards/${boardId}`, "layout");
}

const COLUMN_TYPES = ["text", "person", "status", "date", "link", "number"];
// Core columns that must not be deleted (the board depends on them).
const PROTECTED_KEYS = new Set(["task_id", "name"]);

/** Employee-only: add a new column to a board. */
export async function addColumn(
  boardId: string,
  label: string,
  type: string,
) {
  await requireEmployee();
  const name = label.trim();
  if (!name) return;
  const t = COLUMN_TYPES.includes(type) ? type : "text";
  const supabase = await createServerSupabase();

  const { data: existing } = await supabase
    .from("columns")
    .select("key, position")
    .eq("board_id", boardId)
    .returns<{ key: string; position: number }[]>();
  const keys = new Set((existing ?? []).map((c) => c.key));
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 24) || "feld";
  let key = base;
  let n = 2;
  while (keys.has(key)) key = `${base}_${n++}`;
  const position =
    Math.max(-1, ...(existing ?? []).map((c) => c.position)) + 1;

  // A status column needs at least one option to be usable straight away.
  const options =
    t === "status"
      ? {
          options: [
            { label: "Offen", color: "#9e9e9e" },
            { label: "Fertig", color: "#00c875" },
          ],
        }
      : {};

  const { error } = await supabase.from("columns").insert({
    board_id: boardId,
    key,
    label: name,
    type: t,
    position,
    is_required: false,
    options,
  });
  if (error) {
    console.error("addColumn failed", { boardId, error });
    throw new Error(`Spalte konnte nicht erstellt werden: ${error.message}`);
  }
  revalidatePath(`/boards/${boardId}`, "layout");
}

/** Employee-only: rename a column (its header label). */
export async function renameColumn(
  boardId: string,
  columnId: string,
  label: string,
) {
  await requireEmployee();
  const name = label.trim();
  if (!name) return;
  const supabase = await createServerSupabase();
  await supabase.from("columns").update({ label: name }).eq("id", columnId);
  revalidatePath(`/boards/${boardId}`, "layout");
}

/** Employee-only: delete a column (its values cascade). Core columns are kept. */
export async function deleteColumn(boardId: string, columnId: string) {
  await requireEmployee();
  const supabase = await createServerSupabase();
  const { data: col } = await supabase
    .from("columns")
    .select("key")
    .eq("id", columnId)
    .maybeSingle<{ key: string }>();
  if (!col || PROTECTED_KEYS.has(col.key)) return;
  await supabase.from("columns").delete().eq("id", columnId);
  revalidatePath(`/boards/${boardId}`, "layout");
}

/** Employee-only: move a column one slot left (-1) or right (+1). */
export async function moveColumn(
  boardId: string,
  columnId: string,
  dir: -1 | 1,
) {
  await requireEmployee();
  const supabase = await createServerSupabase();
  const { data: cols } = await supabase
    .from("columns")
    .select("id, position")
    .eq("board_id", boardId)
    .order("position", { ascending: true })
    .returns<{ id: string; position: number }[]>();
  const list = cols ?? [];
  const idx = list.findIndex((c) => c.id === columnId);
  const swap = idx + dir;
  if (idx < 0 || swap < 0 || swap >= list.length) return;
  const a = list[idx];
  const b = list[swap];
  await supabase.from("columns").update({ position: b.position }).eq("id", a.id);
  await supabase.from("columns").update({ position: a.position }).eq("id", b.id);
  revalidatePath(`/boards/${boardId}`, "layout");
}

/** Post a comment or a reply (parentId) on a task. */
export async function postComment(
  boardId: string,
  taskId: string,
  body: string,
  parentId?: string | null,
) {
  const b = body.trim();
  if (!b) return;
  const ctx = await requireSession();
  const supabase = await createServerSupabase();
  const { data: inserted } = await supabase
    .from("comments")
    .insert({
      task_id: taskId,
      body: b,
      author_id: ctx.userId,
      parent_id: parentId ?? null,
    })
    .select("id")
    .single<{ id: string }>();
  const commentId = inserted?.id ?? null;
  after(() =>
    notifyMentions({ boardId, taskId, body: b, actorId: ctx.userId, commentId }),
  );
  after(() =>
    notifyComment({
      boardId,
      taskId,
      actorId: ctx.userId,
      body: b,
      parentId,
      commentId,
    }),
  );
  // A comment on a customer task is the briefing → (re)sync the internal
  // mirror. Runs after the response; idempotent and a no-op on internal boards.
  after(() => syncMirrorForCustomerTask(taskId));
  after(() => suggestTriage(taskId));
  after(() => refreshGroupSummaries(taskId));
  after(() =>
    logTaskEvent(
      taskId,
      ctx.userId,
      "commented",
      parentId ? "Auf einen Kommentar geantwortet" : "Kommentar geschrieben",
    ),
  );
  revalidatePath(`/boards/${boardId}/tasks/${taskId}`);
  revalidatePath(`/boards/${boardId}`);
}

/** Employee-only: generate ad creatives for a task (on demand). */
export async function requestCreatives(boardId: string, taskId: string) {
  await requireEmployee();
  const payload = await generateCreatives(taskId);
  revalidatePath(`/boards/${boardId}/tasks/${taskId}`);
  return payload;
}

/** Toggle the current user's like on a comment. */
export async function toggleLike(
  boardId: string,
  taskId: string,
  commentId: string,
) {
  const ctx = await requireSession();
  const supabase = await createServerSupabase();
  const { data: existing } = await supabase
    .from("comment_likes")
    .select("comment_id")
    .eq("comment_id", commentId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (existing) {
    await supabase
      .from("comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", ctx.userId);
  } else {
    await supabase
      .from("comment_likes")
      .insert({ comment_id: commentId, user_id: ctx.userId });
    after(() =>
      notifyReaction({ boardId, taskId, commentId, actorId: ctx.userId }),
    );
  }
  revalidatePath(`/boards/${boardId}/tasks/${taskId}`);
}

/** Mark a task's update thread as read for the current user (clears the unread
 * highlight). Fire-and-forget from the client. */
export async function markTaskRead(taskId: string) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("task_reads")
    .upsert(
      { user_id: user.id, task_id: taskId, last_read_at: new Date().toISOString() },
      { onConflict: "user_id,task_id" },
    );
}

/** Mark all of the current user's notifications as read. */
export async function markNotificationsRead() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);
}

/** Save a task's title and its column values (upsert into task_values). */
export async function saveTask(
  boardId: string,
  taskId: string,
  columnIds: string[],
  formData: FormData,
) {
  const supabase = await createServerSupabase();

  const title = String(formData.get("title") ?? "").trim();
  if (title) {
    await supabase.from("tasks").update({ title }).eq("id", taskId);
  }

  const rows = columnIds.map((columnId) => {
    const raw = formData.get(`col_${columnId}`);
    const str = raw === null ? "" : String(raw).trim();
    return {
      task_id: taskId,
      column_id: columnId,
      value: str === "" ? null : str,
    };
  });

  if (rows.length > 0) {
    await supabase
      .from("task_values")
      .upsert(rows, { onConflict: "task_id,column_id" });
  }

  revalidatePath(`/boards/${boardId}/tasks/${taskId}`);
  revalidatePath(`/boards/${boardId}`);
}

export async function addComment(
  boardId: string,
  taskId: string,
  formData: FormData,
) {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  const ctx = await requireSession();
  const supabase = await createServerSupabase();

  const { data: inserted } = await supabase
    .from("comments")
    .insert({ task_id: taskId, body, author_id: ctx.userId })
    .select("id")
    .single<{ id: string }>();
  const commentId = inserted?.id ?? null;

  after(() =>
    notifyMentions({ boardId, taskId, body, actorId: ctx.userId, commentId }),
  );
  after(() =>
    notifyComment({ boardId, taskId, actorId: ctx.userId, body, commentId }),
  );
  after(() => syncMirrorForCustomerTask(taskId));
  after(() => suggestTriage(taskId));
  after(() => refreshGroupSummaries(taskId));
  after(() =>
    logTaskEvent(taskId, ctx.userId, "commented", "Kommentar geschrieben"),
  );
  revalidatePath(`/boards/${boardId}/tasks/${taskId}`);
}

/**
 * Return channel: an employee releases a result from an internal task to the
 * linked customer task. This is the ONLY path by which internal work reaches a
 * customer, and it is always human-initiated. It posts a customer-visible
 * comment (and optionally a status) on the customer task — never copies the
 * internal task, its notes, or its comments.
 */
export async function releaseToCustomer(
  internalBoardId: string,
  internalTaskId: string,
  formData: FormData,
) {
  const ctx = await requireEmployee();
  const body = String(formData.get("body") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!body && !status) return; // nothing to release

  const supabase = await createServerSupabase();

  // Authoritative link lookup — never trust a client-supplied customer id.
  const { data: link } = await supabase
    .from("task_links")
    .select("customer_task_id")
    .eq("internal_task_id", internalTaskId)
    .maybeSingle<{ customer_task_id: string }>();
  if (!link) return;
  const customerTaskId = link.customer_task_id;

  // Optional: set the customer task's status.
  if (status) {
    const { data: ctask } = await supabase
      .from("tasks")
      .select("board_id")
      .eq("id", customerTaskId)
      .single<{ board_id: string }>();
    if (ctask) {
      const { data: statusCol } = await supabase
        .from("columns")
        .select("id")
        .eq("board_id", ctask.board_id)
        .eq("key", "status")
        .maybeSingle<{ id: string }>();
      if (statusCol) {
        await supabase
          .from("task_values")
          .upsert(
            { task_id: customerTaskId, column_id: statusCol.id, value: status },
            { onConflict: "task_id,column_id" },
          );
      }
    }
  }

  // The customer-visible comment (authored by the employee → shows as "Team").
  if (body) {
    await supabase
      .from("comments")
      .insert({ task_id: customerTaskId, author_id: ctx.userId, is_agent: false, body });
  }

  // Audit the release (audit_log has no client insert policy → service client).
  const svc = createServiceClient();
  await svc.from("audit_log").insert({
    actor_id: ctx.userId,
    action: "task.release_to_customer",
    entity_type: "task",
    entity_id: customerTaskId,
    details: { internal_task_id: internalTaskId, status: status || null },
  });

  revalidatePath(`/boards/${internalBoardId}/tasks/${internalTaskId}`);
  redirect(`/boards/${internalBoardId}/tasks/${internalTaskId}?released=1`);
}

/**
 * Return channel (per-comment): an employee releases ONE internal comment to
 * the linked customer task. The comment must belong to this task's mirror group
 * (the customer task or one of its internal copies) — never an arbitrary id.
 * A customer-visible copy is posted on the customer task; the source comment is
 * stamped `released_at` so it can't be released twice.
 */
export async function releaseComment(
  internalBoardId: string,
  internalTaskId: string,
  commentId: string,
) {
  const ctx = await requireEmployee();
  const supabase = await createServerSupabase();

  // The customer task this internal task mirrors.
  const { data: link } = await supabase
    .from("task_links")
    .select("customer_task_id")
    .eq("internal_task_id", internalTaskId)
    .maybeSingle<{ customer_task_id: string }>();
  if (!link) return;
  const customerTaskId = link.customer_task_id;

  // Every task in this mirror group: the customer task + all its internal copies.
  const { data: siblings } = await supabase
    .from("task_links")
    .select("internal_task_id")
    .eq("customer_task_id", customerTaskId)
    .returns<{ internal_task_id: string }[]>();
  const groupTaskIds = new Set<string>([
    customerTaskId,
    ...(siblings ?? []).map((s) => s.internal_task_id),
  ]);

  // Load the comment and verify it belongs to this group and isn't already sent.
  const { data: comment } = await supabase
    .from("comments")
    .select("id, task_id, body, is_agent, released_at")
    .eq("id", commentId)
    .maybeSingle<{
      id: string;
      task_id: string;
      body: string;
      is_agent: boolean;
      released_at: string | null;
    }>();
  if (!comment) return;
  if (!groupTaskIds.has(comment.task_id)) return; // not part of this task
  if (comment.task_id === customerTaskId) return; // already customer-visible
  if (comment.is_agent) return; // don't forward the agent's internal work order
  if (comment.released_at) return; // already released

  // Atomically claim the release: only the caller whose conditional UPDATE
  // actually stamps released_at (was NULL) proceeds to post the copy. A second
  // concurrent click updates zero rows and bails — no double-post.
  const { data: stamped } = await supabase
    .from("comments")
    .update({ released_at: new Date().toISOString() })
    .eq("id", commentId)
    .is("released_at", null)
    .select("id");
  if (!stamped || stamped.length === 0) return;

  // Post the customer-visible copy (authored by the employee → shows as "Team").
  await supabase.from("comments").insert({
    task_id: customerTaskId,
    author_id: ctx.userId,
    is_agent: false,
    body: comment.body,
  });

  const svc = createServiceClient();
  await svc.from("audit_log").insert({
    actor_id: ctx.userId,
    action: "comment.release_to_customer",
    entity_type: "comment",
    entity_id: commentId,
    details: { customer_task_id: customerTaskId, internal_task_id: internalTaskId },
  });

  revalidatePath(`/boards/${internalBoardId}/tasks/${internalTaskId}`);
}

/** Upload a file attachment to a task. Storage RLS ties access to the board. */
export async function uploadAttachment(
  boardId: string,
  taskId: string,
  formData: FormData,
) {
  const ctx = await requireSession();
  const file = formData.get("file");
  const taskUrl = `/boards/${boardId}/tasks/${taskId}`;

  if (!(file instanceof File) || file.size === 0) return;
  if (file.size > MAX_UPLOAD_BYTES) {
    redirect(`${taskUrl}?err=${encodeURIComponent("Datei zu groß (max. 10 MB)")}`);
  }

  const supabase = await createServerSupabase();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const path = `${boardId}/${taskId}/${crypto.randomUUID()}-${safeName}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) {
    redirect(`${taskUrl}?err=${encodeURIComponent("Upload fehlgeschlagen")}`);
  }

  const { error: insErr } = await supabase.from("attachments").insert({
    task_id: taskId,
    storage_path: path,
    file_name: file.name.slice(0, 200),
    size_bytes: file.size,
    content_type: file.type || null,
    uploaded_by: ctx.userId,
  });
  if (insErr) {
    // Roll back the stored object if the metadata row couldn't be written.
    await supabase.storage.from(BUCKET).remove([path]);
    redirect(`${taskUrl}?err=${encodeURIComponent("Datei konnte nicht gespeichert werden")}`);
  }

  revalidatePath(taskUrl);
}

export async function deleteAttachment(
  boardId: string,
  taskId: string,
  attachmentId: string,
  storagePath: string,
) {
  await requireSession();
  const supabase = await createServerSupabase();

  // RLS: only the uploader or an employee may delete the row / object.
  const { error } = await supabase.from("attachments").delete().eq("id", attachmentId);
  if (!error) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
  }
  revalidatePath(`/boards/${boardId}/tasks/${taskId}`);
}

export async function deleteTask(boardId: string, taskId: string) {
  const supabase = await createServerSupabase();
  await supabase.from("tasks").delete().eq("id", taskId);
  revalidatePath(`/boards/${boardId}`);
  redirect(`/boards/${boardId}`);
}

/** Delete several tasks at once (e.g. selected rows + Delete key). No redirect. */
export async function deleteTasks(boardId: string, taskIds: string[]) {
  if (!taskIds.length) return;
  const supabase = await createServerSupabase();
  await supabase.from("tasks").delete().in("id", taskIds);
  revalidatePath(`/boards/${boardId}`);
}
