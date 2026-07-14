"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

/** Create a task on a board. RLS ensures the caller may write to this board. */
export async function createTask(boardId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const supabase = await createServerSupabase();
  await supabase.from("tasks").insert({ board_id: boardId, title });

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

export async function deleteTask(boardId: string, taskId: string) {
  const supabase = await createServerSupabase();
  await supabase.from("tasks").delete().eq("id", taskId);
  revalidatePath(`/boards/${boardId}`);
  redirect(`/boards/${boardId}`);
}
