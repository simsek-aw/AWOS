"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Update the current user's display name. Uses the service client because
 * migration 0006 deliberately revoked user updates on `profiles` (a user must
 * not be able to change their own role/customer_id/department). This action
 * therefore only ever writes `full_name`, and only for the caller's own row.
 */
export async function updateOwnName(formData: FormData) {
  const ctx = await requireSession();
  const name = String(formData.get("full_name") ?? "").trim().slice(0, 120);
  if (!name) return;
  const svc = createServiceClient();
  const { error } = await svc
    .from("profiles")
    .update({ full_name: name })
    .eq("id", ctx.userId);
  if (error) {
    console.error("updateOwnName failed", { userId: ctx.userId, error });
    throw new Error(`Name konnte nicht gespeichert werden: ${error.message}`);
  }
  revalidatePath("/profile");
  revalidatePath("/", "layout");
}
