"use server";

import { askAssistant, type ChatMessage } from "@/lib/agent/assistant";
import { requireEmployee } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/** Ask the internal AWOS assistant. Employee-only. */
export async function askAwosAssistant(
  history: ChatMessage[],
): Promise<string> {
  await requireEmployee();
  const supabase = await createServerSupabase();
  // Sanitize the incoming history shape (client-supplied).
  const clean: ChatMessage[] = (history ?? [])
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  return askAssistant(supabase, clean);
}
