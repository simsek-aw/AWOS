// Creative-Agent chat — an iterative brainstorming partner for ad creative.
// Pure chat (no DB access): the employee describes a product/campaign and the
// agent proposes and refines headlines, sublines, CTAs and visual ideas.
import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage } from "@/lib/agent/assistant";

const MODEL = "claude-opus-4-8";

const SYSTEM_PROMPT = `Du bist der Creative-Agent einer deutschen Werbeagentur (AWOS) – ein erfahrener
Creative Director. Du hilfst dem Team, Werbeideen zu entwickeln und iterativ zu
verfeinern: Headlines, Sublines, Call-to-Actions und Visual-Ideen.

Arbeitsweise:
- Wenn ein Briefing kommt, liefere konkrete, sofort nutzbare Vorschläge –
  gegliedert nach Headlines, Sublines, CTAs und Visual-Ideen.
- Reagiere auf Feedback und schärfe nach ("kürzer", "mehr B2B", "emotionaler",
  "auf Familien ausgerichtet" usw.).
- Deutsch, prägnant, on-brand. Keine langen Erklärungen – Ideen zählen.
- Wenn dir Infos fehlen (Zielgruppe, Ton, Kanal), stelle 1–2 kurze Rückfragen,
  bevor du ins Detail gehst.`;

export async function askCreativeChat(history: ChatMessage[]): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return "Der Creative-Agent ist noch nicht konfiguriert (ANTHROPIC_API_KEY fehlt).";
  }
  if (!history.length) return "";

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1400,
      system: SYSTEM_PROMPT,
      messages: history.slice(-14).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return text || "Mir fällt gerade nichts ein – versuch es nochmal.";
  } catch (err) {
    console.error("askCreativeChat failed:", err);
    return "Es gab ein Problem bei der Anfrage. Bitte versuche es erneut.";
  }
}
