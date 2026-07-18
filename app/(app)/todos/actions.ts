"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export type Todo = {
  id: string;
  text: string;
  done: boolean;
  created_at: string;
  customer_id: string | null;
};

// Add a personal to-do, optionally tagged with a customer. Returns the created
// row (or null on failure) so the client can update optimistically.
export async function addTodo(
  text: string,
  customerId?: string | null,
): Promise<Todo | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const ctx = await requireSession();
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("personal_todos")
    .insert({
      user_id: ctx.userId,
      text: trimmed.slice(0, 500),
      customer_id: customerId || null,
    })
    .select("id, text, done, created_at, customer_id")
    .single<Todo>();
  revalidatePath("/");
  return data ?? null;
}

// Re-tag a note with a different customer (or clear it with null).
export async function setTodoCustomer(id: string, customerId: string | null) {
  const ctx = await requireSession();
  const supabase = await createServerSupabase();
  await supabase
    .from("personal_todos")
    .update({ customer_id: customerId || null })
    .eq("id", id)
    .eq("user_id", ctx.userId);
  revalidatePath("/");
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
