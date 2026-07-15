import Icon, { type IconName } from "@/components/icons";
import { requireEmployee } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Agents overview (employees only). Interactive agents open a chat; automatic
// agents run in the background and are shown here for transparency.
export default async function AgentsPage() {
  await requireEmployee();

  return (
    <div className="page-pad" style={{ padding: "24px 28px", maxWidth: 980 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Agents</h1>
      <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0 }}>
        Interne KI-Helfer. Nur für Mitarbeiter.
      </p>

      <h2 style={sectionH}>Zum Chatten</h2>
      <div style={grid}>
        <AgentCard
          href="/agents/assistant"
          icon="sparkles"
          title="AWOS-Assistent"
          desc="Fragen zu deinen Boards, Aufgaben, Deadlines und Auslastung."
          cta="Chat öffnen"
        />
        <AgentCard
          href="/agents/creative"
          icon="sparkles"
          title="Creative-Agent"
          desc="Ad-Ideen entwickeln und iterativ nachschärfen: Headlines, Sublines, CTAs, Visual-Ideen."
          cta="Chat öffnen"
        />
      </div>

      <h2 style={sectionH}>Laufen automatisch</h2>
      <div style={grid}>
        <AgentCard
          icon="link"
          title="Spiegel-Agent"
          desc="Spiegelt Kunden-Tasks bei Kommentar/Zuweisung in die Abteilungs-Boards."
          note="Automatisch"
          muted
        />
        <AgentCard
          icon="bell"
          title="Deadline-Manager"
          desc="Erinnert an fällige/überfällige Aufgaben und archiviert Inaktives."
          note="Täglich"
          muted
        />
        <AgentCard
          icon="message"
          title="Tages-Digest & Board-Report"
          desc="Fasst offene Aufgaben und Board-Gesundheit für das Team zusammen."
          note="Täglich"
          muted
        />
        <AgentCard
          icon="user"
          title="Triage & Team-Scheduler"
          desc="Schlägt Abteilung, Priorität und die am wenigsten ausgelastete Person vor."
          note="Bei neuem Briefing"
          muted
        />
      </div>
    </div>
  );
}

function AgentCard({
  href,
  icon,
  title,
  desc,
  cta,
  note,
  muted = false,
}: {
  href?: string;
  icon: IconName;
  title: string;
  desc: string;
  cta?: string;
  note?: string;
  muted?: boolean;
}) {
  const inner = (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        background: "var(--surface)",
        padding: 16,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        opacity: muted ? 0.85 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            display: "inline-flex",
            width: 34,
            height: 34,
            borderRadius: 8,
            background: "var(--surface-2)",
            alignItems: "center",
            justifyContent: "center",
            color: muted ? "var(--muted)" : "var(--accent)",
            flexShrink: 0,
          }}
        >
          <Icon name={icon} size={18} />
        </span>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
        {note && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: "var(--faint)",
              border: "1px solid var(--border)",
              borderRadius: 999,
              padding: "2px 8px",
              whiteSpace: "nowrap",
            }}
          >
            {note}
          </span>
        )}
      </div>
      <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
        {desc}
      </div>
      {cta && (
        <div
          style={{
            marginTop: "auto",
            color: "var(--accent)",
            fontSize: 13,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {cta} <Icon name="arrow-right" size={14} />
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <a href={href} style={{ textDecoration: "none", color: "var(--text)" }}>
        {inner}
      </a>
    );
  }
  return inner;
}

const sectionH: React.CSSProperties = {
  fontSize: 13,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "var(--faint)",
  margin: "24px 0 10px",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  gap: 12,
};
