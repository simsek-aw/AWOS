import ProfileNameForm from "@/components/ProfileNameForm";
import ThemeToggle from "@/components/ThemeToggle";
import { requireSession } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const roleLabel: Record<string, string> = {
  employee: "Mitarbeiter",
  customer: "Kunde",
};
const deptLabel: Record<string, string> = {
  marketing: "Marketing",
  content: "Content",
  grafik: "Grafik",
};

export default async function ProfilePage() {
  const ctx = await requireSession();
  const supabase = await createServerSupabase();

  let companyName: string | null = null;
  if (ctx.profile.customer_id) {
    const { data } = await supabase
      .from("customers")
      .select("name")
      .eq("id", ctx.profile.customer_id)
      .maybeSingle<{ name: string }>();
    companyName = data?.name ?? null;
  }

  return (
    <div className="page-pad page-enter" style={{ padding: "24px 28px", maxWidth: 620 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px" }}>
        Einstellungen
      </h1>
      <div className="brand-bar" style={{ width: 48, marginBottom: 20 }} />

      {/* Appearance / theme */}
      <section style={card}>
        <h2 style={cardH}>Darstellung</h2>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 12px" }}>
          Wähle dein bevorzugtes Design. Die Auswahl gilt für diesen Browser.
        </p>
        <ThemeToggle />
      </section>

      {/* Name (editable) */}
      <section style={card}>
        <h2 style={cardH}>Name</h2>
        <ProfileNameForm initial={ctx.profile.full_name ?? ""} />
      </section>

      {/* Account info (read-only) */}
      <section style={card}>
        <h2 style={cardH}>Konto</h2>
        <Row label="E-Mail" value={ctx.email ?? "—"} />
        <Row label="Rolle" value={roleLabel[ctx.profile.role] ?? ctx.profile.role} />
        {ctx.profile.role === "customer" && (
          <Row label="Firma" value={companyName ?? "—"} />
        )}
        {ctx.profile.role === "employee" && ctx.profile.department && (
          <Row label="Abteilung" value={deptLabel[ctx.profile.department] ?? ctx.profile.department} />
        )}
        <p style={{ color: "var(--faint)", fontSize: 12, marginTop: 10, marginBottom: 0 }}>
          Rolle, Firma und Abteilung werden von der Administration verwaltet.
        </p>
      </section>

      {/* Password */}
      <section style={card}>
        <h2 style={cardH}>Passwort</h2>
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0 }}>
          Ändere dein Passwort über die Passwort-Seite.
        </p>
        <a
          href="/auth/update-password"
          className="lift"
          style={{
            display: "inline-block",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "8px 14px",
            color: "var(--text)",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Passwort ändern
        </a>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "8px 0",
        borderBottom: "1px solid var(--border)",
        fontSize: 14,
      }}
    >
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span style={{ textAlign: "right" }}>{value}</span>
    </div>
  );
}

const card: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 12,
  background: "var(--surface)",
  padding: 16,
  marginBottom: 16,
};
const cardH: React.CSSProperties = { fontSize: 15, margin: "0 0 10px" };
