"use server";

import { revalidatePath } from "next/cache";
import { askAssistant, type ChatMessage } from "@/lib/agent/assistant";
import { askCreativeChat } from "@/lib/agent/creative-chat";
import type { AutomationKey } from "@/lib/agent/settings";
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

/** Employee-only: enable/disable an automatic agent. */
export async function setAutomation(key: AutomationKey, enabled: boolean) {
  await requireEmployee();
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("automation_settings")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) {
    console.error("setAutomation failed", { key, error });
    throw new Error(`Einstellung konnte nicht gespeichert werden: ${error.message}`);
  }
  revalidatePath("/agents/automations");
}
