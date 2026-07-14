// Browser Supabase client.
// Uses ONLY the public anon key, so every query is subject to Row-Level-Security.
// Never import the service role key here — this code runs in the browser.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
