"use server";

import { askAssistant, type ChatMessage } from "@/lib/agent/assistant";
import { askCreativeChat } from "@/lib/agent/creative-chat";
import { requireEmployee } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/** Sanitize client-supplied chat history to a bounded, valid shape. */
function cleanHistory(history: ChatMessage[]): ChatMessage[] {
  return (history ?? [])
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
}

/** Ask the internal AWOS assistant. Employee-only. */
export async function askAwosAssistant(
  history: ChatMessage[],
): Promise<string> {
  await requireEmployee();
  const supabase = await createServerSupabase();
  return askAssistant(supabase, cleanHistory(history));
}

/** Ask the creative agent (iterative ad-idea brainstorming). Employee-only. */
export async function askCreativeAgent(
  history: ChatMessage[],
): Promise<string> {
  await requireEmployee();
  return askCreativeChat(cleanHistory(history));
}
