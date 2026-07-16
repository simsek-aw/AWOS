import AppHeader from "@/components/AppHeader";
import TeamImport from "@/components/admin/TeamImport";
import UserRow from "@/components/admin/UserRow";
import { requireEmployee } from "@/lib/auth";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import type { Board, Customer, Profile } from "@/lib/types";
import {
  createCustomer,
  createCustomerBoard,
  createInternalBoard,
  inviteUser,
  renameBoard,
  setBoardArchived,
} from "./actions";

const deptLabel: Record<string, string> = {
  marketing: "Marketing",
  content: "Content",
  grafik: "Grafik",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const ctx = await requireEmployee();
  const { error, ok } = await searchParams;
  const supabase = await createServerSupabase();

  const [{ data: customers }, { data: boards }, { data: profiles }] =
    await Promise.all([
      supabase.from("customers").select("*").order("name").returns<Customer[]>(),
      supabase.from("boards").select("*").order("name").returns<Board[]>(),
      supabase
        .from("profiles")
        .select("*")
        .order("created_at")
        .returns<Profile[]>(),
    ]);

  const customerList = customers ?? [];
  const customerName = new Map(customerList.map((c) => [c.id, c.name]));

  // Emails aren't in `profiles`; fetch them from the auth admin API (service
  // role) so we can show and act on them in the user editor.
  const emailById = new Map<string, string>();
  try {
    const svc = createServiceClient();
    const { data: authUsers } = await svc.auth.admin.listUsers({ perPage: 1000 });
    for (const u of authUsers?.users ?? []) {
      if (u.email) emailById.set(u.id, u.email);
    }
  } catch {
    // Non-fatal: the editor still works without emails shown.
  }

  return (
    <>
      <AppHeader ctx={ctx} />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px" }}>
        <a href="/" style={{ color: "var(--muted)", fontSize: 14 }}>
          ← Boards
        </a>
        <h1 style={{ fontSize: 24, marginTop: 8 }}>Administration</h1>

        <a
          href="/admin/import"
          style={{
            display: "inline-block",
            marginTop: 8,
            marginBottom: 4,
            fontSize: 14,
            fontWeight: 600,
            color: "var(--accent)",
          }}
        >
          ↥ Import aus monday →
        </a>

        {error && <Banner tone="error">{error}</Banner>}
        {ok && <Banner tone="ok">{ok}</Banner>}

        {/* --- Team import --- */}
        <Section title="Team-Import (CSV)">
          <TeamImport />
        </Section>

        {/* --- Customers --- */}
        <Section title="Kunden">
          <ul style={listStyle}>
            {customerList.map((c) => (
              <li key={c.id} style={rowStyle}>
                {c.name}
              </li>
            ))}
            {customerList.length === 0 && <Empty>Noch keine Kunden.</Empty>}
          </ul>
          <form action={createCustomer} style={formRow}>
            <input name="name" placeholder="Neuer Kundenname" required style={input} />
            <button style={button}>Kunde anlegen</button>
          </form>
        </Section>

        {/* --- Boards --- */}
        <Section title="Boards">
          <ul style={listStyle}>
            {(boards ?? []).map((b) => (
              <li
                key={b.id}
                style={{ ...rowStyle, gap: 8, opacity: b.archived_at ? 0.55 : 1 }}
              >
                <form
                  action={renameBoard}
                  style={{ display: "flex", gap: 6, flex: 1, minWidth: 0 }}
                >
                  <input type="hidden" name="board_id" value={b.id} />
                  <input
                    name="name"
                    defaultValue={b.name}
                    style={{ ...input, flex: 1, minWidth: 0 }}
                  />
                  <button style={{ ...button, padding: "6px 10px" }}>Umbenennen</button>
                </form>
                <span style={{ color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>
                  {b.type === "internal"
                    ? `Intern${b.department ? " · " + deptLabel[b.department] : ""}`
                    : `Kunde · ${b.customer_id ? customerName.get(b.customer_id) : "?"}`}
                  {b.archived_at ? " · archiviert" : ""}
                </span>
                <form action={setBoardArchived}>
                  <input type="hidden" name="board_id" value={b.id} />
                  <input type="hidden" name="archived" value={b.archived_at ? "0" : "1"} />
                  <button
                    style={{
                      background: "transparent",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "6px 10px",
                      color: "var(--muted)",
                      fontSize: 13,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {b.archived_at ? "Wiederherstellen" : "Archivieren"}
                  </button>
                </form>
              </li>
            ))}
            {(boards ?? []).length === 0 && <Empty>Noch keine Boards.</Empty>}
          </ul>

          <form action={createInternalBoard} style={formRow}>
            <input name="name" placeholder="Internes Board" required style={input} />
            <select name="department" style={input} defaultValue="">
              <option value="">Ohne Abteilung</option>
              <option value="marketing">Marketing</option>
              <option value="content">Content</option>
              <option value="grafik">Grafik</option>
            </select>
            <button style={button}>Intern anlegen</button>
          </form>

          <form action={createCustomerBoard} style={formRow}>
            <input name="name" placeholder="Kunden-Board" required style={input} />
            <select name="customer_id" style={input} required defaultValue="">
              <option value="" disabled>
                Kunde wählen…
              </option>
              {customerList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button style={button}>Kunden-Board anlegen</button>
          </form>
        </Section>

        {/* --- Users --- */}
        <Section title="Nutzer">
          <ul style={listStyle}>
            {(profiles ?? []).map((p) => (
              <UserRow
                key={p.id}
                profile={p}
                email={emailById.get(p.id) ?? null}
                customers={customerList}
                isSelf={p.id === ctx.userId}
              />
            ))}
          </ul>

          <form action={inviteUser} style={{ display: "grid", gap: 8, marginTop: 12 }}>
            <div style={formRow}>
              <input name="full_name" placeholder="Name" style={input} />
              <input name="email" type="email" placeholder="E-Mail" required style={input} />
              <select name="role" style={input} defaultValue="customer">
                <option value="customer">Kunde</option>
                <option value="employee">Mitarbeiter</option>
              </select>
            </div>
            <div style={formRow}>
              <select name="customer_id" style={input} defaultValue="">
                <option value="">— Kunde (nur bei Rolle „Kunde") —</option>
                {customerList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select name="department" style={input} defaultValue="">
                <option value="">— Abteilung (optional, Mitarbeiter) —</option>
                <option value="marketing">Marketing</option>
                <option value="content">Content</option>
                <option value="grafik">Grafik</option>
              </select>
            </div>
            <button style={{ ...button, justifySelf: "start" }}>Einladen</button>
          </form>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            Der Eingeladene erhält eine E-Mail, bestätigt den Link und setzt sein eigenes
            Passwort. Kunden sehen nur ihr eigenes Board, Mitarbeiter alle. Passwörter
            lassen sich pro Nutzer über „Bearbeiten" auch direkt setzen (ohne E-Mail).
          </p>
          <p style={{ color: "var(--faint)", fontSize: 12 }}>
            Hinweis zum Reset-Link per E-Mail: Damit dieser nicht auf der
            Login-Seite landet, muss in Supabase unter Authentication → Email
            Templates → „Reset Password" der Link auf{" "}
            <code>
              {"{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/update-password"}
            </code>{" "}
            zeigen. Der direkte Weg „Passwort setzen" umgeht das komplett.
          </p>
        </Section>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 16, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Banner({ tone, children }: { tone: "error" | "ok"; children: React.ReactNode }) {
  return (
    <p
      style={{
        marginTop: 12,
        padding: "8px 12px",
        borderRadius: 8,
        fontSize: 14,
        background: tone === "error" ? "var(--danger-bg)" : "var(--ok-bg)",
        color: tone === "error" ? "var(--danger)" : "var(--ok-text)",
      }}
    >
      {children}
    </p>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <li style={{ ...rowStyle, color: "var(--faint)" }}>{children}</li>;
}

const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: "12px 0",
  display: "grid",
  gap: 6,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 14,
};

const formRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 8,
  flexWrap: "wrap",
};

const input: React.CSSProperties = {
  flex: 1,
  minWidth: 160,
  background: "var(--input-bg)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "9px 12px",
  color: "var(--text)",
  fontSize: 14,
};

const button: React.CSSProperties = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "9px 16px",
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
