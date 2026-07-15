import AutomationToggle from "@/components/agents/AutomationToggle";
import Icon, { type IconName } from "@/components/icons";
import type { AutomationKey } from "@/lib/agent/settings";
import { requireEmployee } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const META: {
  key: AutomationKey;
  icon: IconName;
  title: string;
  desc: string;
  cadence: string;
  showLastRun: boolean;
}[] = [
  {
    key: "mirror",
    icon: "link",
    title: "Spiegel-Agent",
    desc: "Spiegelt Kunden-Tasks bei Kommentar/Zuweisung in die Abteilungs-Boards.",
    cadence: "Bei Ereignis",
    showLastRun: false,
  },
  {
    key: "triage",
    icon: "user",
    title: "Triage & Team-Scheduler",
    desc: "Schlägt Abteilung, Priorität und die am wenigsten ausgelastete Person vor.",
    cadence: "Bei neuem Briefing",
    showLastRun: false,
  },
  {
    key: "reply",
    icon: "message",
    title: "Auto-Reply-Entwurf",
    desc: "Entwirft eine Kundenantwort (intern, zur Freigabe), wenn ein Task fertig ist.",
    cadence: "Bei Status Fertig",
    showLastRun: false,
  },
  {
    key: "reminders",
    icon: "bell",
    title: "Deadline-Manager",
    desc: "Erinnert an fällige/überfällige Aufgaben und archiviert Inaktives.",
    cadence: "Täglich",
    showLastRun: true,
  },
  {
    key: "digest",
    icon: "message",
    title: "Tages-Digest & Board-Report",
    desc: "Fasst offene Aufgaben und Board-Gesundheit für das Team zusammen.",
    cadence: "Täglich",
    showLastRun: true,
  },
];

function ago(iso: string | null): string {
  if (!iso) return "noch nie";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "gerade eben";
  if (s < 3600) return `vor ${Math.floor(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std.`;
  return `vor ${Math.floor(s / 86400)} Tg.`;
}

export default async function AutomationsPage() {
  await requireEmployee();
  const supabase = await createServerSupabase();
  const { data: rows } = await supabase
    .from("automation_settings")
    .select("key, enabled, last_run_at")
    .returns<{ key: AutomationKey; enabled: boolean; last_run_at: string | null }[]>();
  const byKey = new Map((rows ?? []).map((r) => [r.key, r]));

  return (
    <div className="page-pad" style={{ padding: "24px 28px", maxWidth: 820 }}>
      <a
        href="/agents"
        style={{ color: "var(--muted)", fontSize: 14, textDecoration: "none" }}
      >
        ← Agents
      </a>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "8px 0 4px" }}>
        Automationen
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0 }}>
        Diese Agents laufen im Hintergrund. Hier kannst du sie an- und ausschalten.
      </p>

      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        {META.map((m) => {
          const row = byKey.get(m.key);
          const enabled = row?.enabled ?? true;
          return (
            <div
              key={m.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                border: "1px solid var(--border)",
                borderRadius: 12,
                background: "var(--surface)",
                padding: 16,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "var(--surface-2)",
                  alignItems: "center",
                  justifyContent: "center",
                  color: enabled ? "var(--accent)" : "var(--muted)",
                  flexShrink: 0,
                }}
              >
                <Icon name={m.icon} size={18} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{m.title}</div>
                <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
                  {m.desc}
                </div>
                <div style={{ color: "var(--faint)", fontSize: 12, marginTop: 4 }}>
                  {m.cadence}
                  {m.showLastRun && ` · zuletzt: ${ago(row?.last_run_at ?? null)}`}
                </div>
              </div>
              <AutomationToggle agentKey={m.key} enabled={enabled} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
