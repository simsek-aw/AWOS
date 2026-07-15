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

// --- Saved chats ----------------------------------------------------------

export type ChatSummary = { id: string; title: string | null; updated_at: string };

type AgentKind = "assistant" | "creative";

async function replyFor(
  agent: AgentKind,
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  history: ChatMessage[],
): Promise<string> {
  return agent === "creative"
    ? askCreativeChat(history)
    : askAssistant(supabase, history);
}

/** List the current user's saved chats for one agent (newest first). */
export async function listAgentChats(
  agent: AgentKind,
): Promise<ChatSummary[]> {
  await requireEmployee();
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("agent_chats")
    .select("id, title, updated_at")
    .eq("agent", agent)
    .order("updated_at", { ascending: false })
    .returns<ChatSummary[]>();
  return data ?? [];
}

/** Load one saved chat's messages (own chats only). */
export async function loadAgentChat(
  chatId: string,
): Promise<{ id: string; messages: ChatMessage[] } | null> {
  await requireEmployee();
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("agent_chats")
    .select("id, messages")
    .eq("id", chatId)
    .maybeSingle<{ id: string; messages: ChatMessage[] }>();
  if (!data) return null;
  return { id: data.id, messages: cleanHistory(data.messages ?? []) };
}

/**
 * Append a user message, get the agent's reply, persist both, and return the
 * updated thread. Creates the chat on the first message. Employee-only.
 */
export async function sendAgentMessage(
  agent: AgentKind,
  chatId: string | null,
  text: string,
): Promise<{ chatId: string; title: string | null; messages: ChatMessage[] }> {
  const ctx = await requireEmployee();
  const supabase = await createServerSupabase();
  const content = String(text ?? "").trim().slice(0, 4000);
  if (!content) throw new Error("Leere Nachricht.");

  let history: ChatMessage[] = [];
  if (chatId) {
    const { data } = await supabase
      .from("agent_chats")
      .select("messages")
      .eq("id", chatId)
      .maybeSingle<{ messages: ChatMessage[] }>();
    history = cleanHistory(data?.messages ?? []);
  }
  history.push({ role: "user", content });

  const reply = await replyFor(agent, supabase, history);
  const messages: ChatMessage[] = [...history, { role: "assistant", content: reply }];

  if (chatId) {
    await supabase
      .from("agent_chats")
      .update({ messages, updated_at: new Date().toISOString() })
      .eq("id", chatId);
    const { data: row } = await supabase
      .from("agent_chats")
      .select("title")
      .eq("id", chatId)
      .maybeSingle<{ title: string | null }>();
    return { chatId, title: row?.title ?? null, messages };
  }

  const title = content.slice(0, 60);
  const { data: created } = await supabase
    .from("agent_chats")
    .insert({ user_id: ctx.userId, agent, title, messages })
    .select("id")
    .single<{ id: string }>();
  return { chatId: created?.id ?? "", title, messages };
}

/** Delete one of the user's saved chats. */
export async function deleteAgentChat(chatId: string) {
  const ctx = await requireEmployee();
  const supabase = await createServerSupabase();
  await supabase
    .from("agent_chats")
    .delete()
    .eq("id", chatId)
    .eq("user_id", ctx.userId);
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
