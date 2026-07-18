"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export type Todo = {
  id: string;
  text: string;
  done: boolean;
  created_at: string;
};

// Add a personal to-do. Returns the created row (or null on failure) so the
// client can update optimistically without a full refresh.
export async function addTodo(text: string): Promise<Todo | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const ctx = await requireSession();
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("personal_todos")
    .insert({ user_id: ctx.userId, text: trimmed.slice(0, 500) })
    .select("id, text, done, created_at")
    .single<Todo>();
  revalidatePath("/");
  return data ?? null;
}

export async function toggleTodo(id: string, done: boolean) {
  const ctx = await requireSession();
  const supabase = await createServerSupabase();
  await supabase
    .from("personal_todos")
    .update({ done })
    .eq("id", id)
    .eq("user_id", ctx.userId);
  revalidatePath("/");
}

export async function deleteTodo(id: string) {
  const ctx = await requireSession();
  const supabase = await createServerSupabase();
  await supabase
    .from("personal_todos")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.userId);
  revalidatePath("/");
}
