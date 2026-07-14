import AppHeader from "@/components/AppHeader";
import { requireEmployee } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Board, Customer, Profile } from "@/lib/types";
import {
  createCustomer,
  createCustomerBoard,
  createInternalBoard,
  inviteUser,
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

  return (
    <>
      <AppHeader ctx={ctx} />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px" }}>
        <a href="/" style={{ color: "var(--muted)", fontSize: 14 }}>
          ← Boards
        </a>
        <h1 style={{ fontSize: 24, marginTop: 8 }}>Administration</h1>

        {error && <Banner tone="error">{error}</Banner>}
        {ok && <Banner tone="ok">{ok}</Banner>}

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
              <li key={b.id} style={rowStyle}>
                <span>{b.name}</span>
                <span style={{ color: "var(--muted)", fontSize: 13 }}>
                  {b.type === "internal"
                    ? `Intern${b.department ? " · " + deptLabel[b.department] : ""}`
                    : `Kunde · ${b.customer_id ? customerName.get(b.customer_id) : "?"}`}
                </span>
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
              <li key={p.id} style={rowStyle}>
                <span>{p.full_name ?? "—"}</span>
                <span style={{ color: "var(--muted)", fontSize: 13 }}>
                  {p.role === "employee"
                    ? `Mitarbeiter${p.department ? " · " + deptLabel[p.department] : ""}`
                    : `Kunde · ${p.customer_id ? customerName.get(p.customer_id) : "?"}`}
                </span>
              </li>
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
            Passwort. Kunden sehen nur ihr eigenes Board, Mitarbeiter alle.
          </p>
        </Section>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 16, borderBottom: "1px solid #222834", paddingBottom: 6 }}>
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
        background: tone === "error" ? "#3b1f24" : "#12301f",
        color: tone === "error" ? "#ff9aa2" : "#7ee2b0",
      }}
    >
      {children}
    </p>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <li style={{ ...rowStyle, color: "#5b6472" }}>{children}</li>;
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
  border: "1px solid #222834",
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
  background: "#0f1115",
  border: "1px solid #2a2f3a",
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
