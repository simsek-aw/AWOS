import AssistantChat from "@/components/agents/AssistantChat";
import Icon from "@/components/icons";
import { requireEmployee } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  await requireEmployee();

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
      <AssistantChat />
    </div>
  );
}
