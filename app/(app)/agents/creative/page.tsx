import { listAgentChats } from "@/app/(app)/agents/actions";
import AgentChat from "@/components/agents/AgentChat";
import Icon from "@/components/icons";
import { requireEmployee } from "@/lib/auth";

export const dynamic = "force-dynamic";

const EXAMPLES = [
  "Sommer-Landingpage für einen Reiseanbieter – gib mir Headlines.",
  "5 CTAs für eine B2B-Softwarekampagne.",
  "Instagram-Captions für eine neue Grafik-Serie, locker und jung.",
  "Claim-Ideen für einen regionalen Handwerksbetrieb.",
];

export default async function CreativePage() {
  await requireEmployee();
  const chats = await listAgentChats("creative");

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
        <Icon name="sparkles" size={20} /> Creative-Agent
      </h1>
      <AgentChat
        agent="creative"
        initialChats={chats}
        examples={EXAMPLES}
        intro="Beschreib das Produkt oder die Kampagne – ich liefere Ideen, die du dann nachschärfen kannst. Zum Beispiel:"
        placeholder="Briefing oder Feedback…"
      />
    </div>
  );
}
