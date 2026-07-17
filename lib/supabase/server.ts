// Server-side Supabase clients.
//
// - createServerSupabase(): request-scoped client using the anon key + the
//   user's session cookies. Still subject to RLS — use this for anything that
//   acts on behalf of the logged-in user.
//
// - createServiceClient(): uses the SERVICE ROLE key, which BYPASSES RLS.
//   Only for trusted background work (the mirroring agent, admin jobs).
//   Never expose its results directly to a client without re-checking access.
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { withCookieDomain } from "./cookie";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, withCookieDomain(options)),
            );
          } catch {
            // Called from a Server Component — safe to ignore; middleware
            // refreshes the session.
          }
        },
      },
    },
  );
}

// SERVICE ROLE — bypasses RLS. Server-only. Handle with extreme care.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
