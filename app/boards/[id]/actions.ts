"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { mirrorCustomerTask } from "@/lib/agent/mirror";
import { requireEmployee, requireSession } from "@/lib/auth";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

const BUCKET = "attachments";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Create a task on a board. RLS ensures the caller may write to this board. */
export async function createTask(boardId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const supabase = await createServerSupabase();
  const { data: task } = await supabase
    .from("tasks")
    .insert({ board_id: boardId, title })
    .select("id")
    .single<{ id: string }>();

  // Run the mirroring agent after the response is sent, so task creation stays
  // instant. The agent decides internally whether this task belongs to a
  // customer board and needs mirroring.
  if (task) {
    after(() => mirrorCustomerTask(task.id));
  }

  revalidatePath(`/boards/${boardId}`);
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

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("comments")
    .insert({ task_id: taskId, body, author_id: user?.id ?? null });

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
