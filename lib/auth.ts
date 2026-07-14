// Server-side auth helpers. Use these in Server Components / Route Handlers
// to get the current user and their profile (role, customer_id).
import { redirect } from "next/navigation";
import { createServerSupabase } from "./supabase/server";
import type { Profile } from "./types";

export interface SessionContext {
  userId: string;
  email: string | null;
  profile: Profile;
}

/**
 * Returns the current session context, or null if not signed in / no profile.
 * getUser() validates the token server-side — do not rely on getSession().
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) return null;
  return { userId: user.id, email: user.email ?? null, profile };
}

/** Like getSessionContext but redirects to /login when unauthenticated. */
export async function requireSession(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  return ctx;
}
