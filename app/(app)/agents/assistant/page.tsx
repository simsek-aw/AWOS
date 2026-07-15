import { listAgentChats } from "@/app/(app)/agents/actions";
import AgentChat from "@/components/agents/AgentChat";
import Icon from "@/components/icons";
import { requireEmployee } from "@/lib/auth";

export const dynamic = "force-dynamic";

const EXAMPLES = [
  "Was ist diese Woche überfällig?",
  "Welche Aufgaben haben keine Deadline?",
  "Wer hat aktuell die meisten offenen Aufgaben?",
  "Fasse die offenen Aufgaben pro Board zusammen.",
];

export default async function AssistantPage() {
  await requireEmployee();
  const chats = await listAgentChats("assistant");

  return (
    <div className="page-pad" style={{ padding: "24px 28px", maxWidth: 820 }}>
      <a
        href="/agents"
        style={{ color: "var(--muted)", fontSize: 14, textDecoration: "none" }}
      >
        ← Agents
      </a>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          margin: "8px 0 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Icon name="sparkles" size={20} /> AWOS-Assistent
      </h1>
      <AgentChat
        agent="assistant"
        initialChats={chats}
        examples={EXAMPLES}
        intro="Frag mich etwas zu deinen Boards und Aufgaben. Zum Beispiel:"
        placeholder="Frage stellen…"
      />
    </div>
  );
}
