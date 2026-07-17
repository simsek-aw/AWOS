import AppHeader from "@/components/AppHeader";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  "awideogram.generate": "AWideogram-Generierungen",
  "awcompose.save": "AWcompose gespeichert",
  "tool.create": "Tool angelegt",
  "tool.update": "Tool bearbeitet",
  "tool.delete": "Tool gelöscht",
  "user.invite": "Nutzer eingeladen",
  "user.admin": "Admin-Rechte geändert",
  "customer.delete": "Kunde gelöscht",
};

export default async function UsagePage() {
  const ctx = await requireAdmin();
  const svc = createServiceClient();

  const now = Date.now();
  const d7 = new Date(now - 7 * 864e5).toISOString();
  const d30 = new Date(now - 30 * 864e5).toISOString();

  const [genTotal, gen7, audit30, profilesRes] = await Promise.all([
    svc
      .from("awideogram_generations")
      .select("id", { count: "exact", head: true }),
    svc
      .from("awideogram_generations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", d7),
    svc
      .from("audit_log")
      .select("action, actor_id, created_at")
      .gte("created_at", d30)
      .returns<
        { action: string; actor_id: string | null; created_at: string }[]
      >(),
    svc.from("profiles").select("id, full_name").returns<
      { id: string; full_name: string | null }[]
    >(),
  ]);

  const audit = audit30.data ?? [];
  const nameById = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p.full_name ?? "?"]),
  );

  const activeUsers7 = new Set(
    audit.filter((a) => a.created_at >= d7 && a.actor_id).map((a) => a.actor_id),
  ).size;
  const activeUsers30 = new Set(
    audit.filter((a) => a.actor_id).map((a) => a.actor_id),
  ).size;

  const actionCounts = new Map<string, number>();
  for (const a of audit)
    actionCounts.set(a.action, (actionCounts.get(a.action) ?? 0) + 1);
  const actions = [...actionCounts.entries()].sort((a, b) => b[1] - a[1]);

  const genByUser = new Map<string, number>();
  for (const a of audit)
    if (a.action === "awideogram.generate" && a.actor_id)
      genByUser.set(a.actor_id, (genByUser.get(a.actor_id) ?? 0) + 1);
  const topGenerators = [...genByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <>
      <AppHeader ctx={ctx} />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
        <a href="/admin" style={{ color: "var(--muted)", fontSize: 14 }}>
          ← Administration
        </a>
        <h1 style={{ fontSize: 24, marginTop: 8 }}>Nutzung</h1>
        <p style={{ color: "var(--muted)", marginTop: -4, fontSize: 14 }}>
          Aktivität der Plattform (Audit-Log der letzten 30 Tage).
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 12,
            marginTop: 20,
          }}
        >
          <Stat label="AWideogram gesamt" value={genTotal.count ?? 0} />
          <Stat label="AWideogram (7 Tage)" value={gen7.count ?? 0} />
          <Stat label="Aktive Nutzer (7 T.)" value={activeUsers7} />
          <Stat label="Aktive Nutzer (30 T.)" value={activeUsers30} />
        </div>

        <section style={{ marginTop: 28 }}>
          <h2 style={h2}>Aktionen (30 Tage)</h2>
          {actions.length === 0 ? (
            <Empty />
          ) : (
            <div style={{ display: "grid", gap: 4 }}>
              {actions.map(([action, cnt]) => (
                <Row key={action} label={ACTION_LABEL[action] ?? action} value={cnt} />
              ))}
            </div>
          )}
        </section>

        <section style={{ marginTop: 28 }}>
          <h2 style={h2}>Top AWideogram-Nutzer (30 Tage)</h2>
          {topGenerators.length === 0 ? (
            <Empty />
          ) : (
            <div style={{ display: "grid", gap: 4 }}>
              {topGenerators.map(([uid, cnt]) => (
                <Row key={uid} label={nameById.get(uid) ?? "?"} value={cnt} />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "8px 12px",
        borderBottom: "1px solid var(--border)",
        fontSize: 14,
      }}
    >
      <span>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function Empty() {
  return (
    <p style={{ color: "var(--faint)", fontSize: 13 }}>
      Noch keine Daten (Audit-Log braucht Migration 0030).
    </p>
  );
}

const h2: React.CSSProperties = {
  fontSize: 16,
  borderBottom: "1px solid var(--border)",
  paddingBottom: 6,
};
