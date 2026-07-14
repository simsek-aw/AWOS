"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export async function setPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    redirect(
      `/auth/update-password?error=${encodeURIComponent("Passwort zu kurz (min. 8 Zeichen)")}`,
    );
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(
      `/auth/update-password?error=${encodeURIComponent("Passwort konnte nicht gesetzt werden")}`,
    );
  }
  redirect("/");
}
