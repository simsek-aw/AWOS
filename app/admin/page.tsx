import AppHeader from "@/components/AppHeader";
import AdminTabs from "@/components/admin/AdminTabs";
import DeleteCustomerButton from "@/components/admin/DeleteCustomerButton";
import TeamImport from "@/components/admin/TeamImport";
import UserRow from "@/components/admin/UserRow";
import { listAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import type { Board, Customer, Profile, Tool } from "@/lib/types";
import {
  createCustomer,
  createCustomerBoard,
  createInternalBoard,
  createTool,
  deleteTool,
  inviteUser,
  moveTool,
  renameBoard,
  setBoardArchived,
  updateTool,
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
  const ctx = await requireAdmin();
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

  // Tools registry (product switcher). Fetched separately so the page still
  // works before migration 0027 is applied.
  let toolList: Tool[] = [];
  try {
    const { data: toolsData } = await supabase
      .from("tools")
      .select("*")
      .order("position", { ascending: true })
      .returns<Tool[]>();
    toolList = toolsData ?? [];
  } catch {
    toolList = [];
  }

  // Recent platform activity (audit log).
  const auditRows = await listAudit(50);

  const customerList = customers ?? [];
  const customerName = new Map(customerList.map((c) => [c.id, c.name]));
  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name ?? "?"]),
  );
  const allBoards = boards ?? [];
  const internalBoards = allBoards.filter((b) => b.type === "internal");
  const boardsOfCustomer = (cid: string) =>
    allBoards.filter((b) => b.type === "customer" && b.customer_id === cid);

  // One board row: rename + archive/restore inline.
  const boardRow = (b: Board) => (
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
        {b.type === "internal" && b.department ? deptLabel[b.department] : ""}
        {b.archived_at ? (b.department ? " · " : "") + "archiviert" : ""}
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
  );

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
        <a href="/boards" style={{ color: "var(--muted)", fontSize: 14 }}>
          ← Boards
        </a>
        <h1 style={{ fontSize: 24, marginTop: 8 }}>Administration</h1>

        <div style={{ display: "flex", gap: 16, marginTop: 8, marginBottom: 4 }}>
          <a
            href="/admin/import"
            style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)" }}
          >
            ↥ Import aus monday →
          </a>
          <a
            href="/admin/usage"
            style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)" }}
          >
            📊 Nutzung →
          </a>
          <a
            href="/api/admin/export?format=csv"
            style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)" }}
          >
            ⬇ Export CSV
          </a>
          <a
            href="/api/admin/export?format=json"
            style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)" }}
          >
            ⬇ Export JSON
          </a>
        </div>

        {error && <Banner tone="error">{error}</Banner>}
        {ok && <Banner tone="ok">{ok}</Banner>}

        <AdminTabs
          defaultKey="customers"
          tabs={[
            {
              key: "tools",
              label: "Tools",
              content: (
        <Section title="Tools (Plattform-Switcher)">
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 12px" }}>
            Diese Tools erscheinen im Umschalter neben dem AWOS-Logo. „Intern" =
            Seite in AWOS, „Link" = externes Tool im neuen Tab, „Einbetten" =
            externes Tool im iframe unter /tools/[key].
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {toolList.map((t, i) => (
              <form
                key={t.id}
                action={updateTool}
                style={{
                  display: "grid",
                  gap: 6,
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 10,
                  opacity: t.enabled ? 1 : 0.7,
                }}
              >
                <input type="hidden" name="id" value={t.id} />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <input
                    name="icon"
                    defaultValue={t.icon ?? ""}
                    placeholder="Icon"
                    style={{ ...input, width: 56, textAlign: "center" }}
                  />
                  <input
                    name="name"
                    defaultValue={t.name}
                    placeholder="Name"
                    required
                    style={{ ...input, width: 130 }}
                  />
                  <select name="kind" defaultValue={t.kind} style={{ ...input, width: 120 }}>
                    <option value="internal">Intern</option>
                    <option value="link">Link</option>
                    <option value="embed">Einbetten</option>
                  </select>
                  <input
                    name="color"
                    defaultValue={t.color ?? ""}
                    placeholder="#579bfc"
                    style={{ ...input, width: 90 }}
                  />
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      color: "var(--muted)",
                    }}
                  >
                    <input type="checkbox" name="enabled" defaultChecked={t.enabled} />
                    Aktiv
                  </label>
                  <select
                    name="visibility"
                    defaultValue={t.visibility ?? "all"}
                    title="Sichtbarkeit"
                    style={{ ...input, width: 150 }}
                  >
                    <option value="all">Alle Mitarbeiter</option>
                    <option value="admins">Nur Admins</option>
                    <option value="marketing">Marketing</option>
                    <option value="content">Content</option>
                    <option value="grafik">Grafik</option>
                  </select>
                  <select
                    name="status"
                    defaultValue={t.status ?? "active"}
                    title="Status"
                    style={{ ...input, width: 130 }}
                  >
                    <option value="active">Aktiv</option>
                    <option value="maintenance">Wartung</option>
                  </select>
                  <span
                    style={{ color: "var(--faint)", fontSize: 12, alignSelf: "center" }}
                  >
                    key: {t.key}
                  </span>
                </div>
                <input
                  name="url"
                  defaultValue={t.url ?? ""}
                  placeholder="URL bzw. Pfad (z. B. https://… oder /my)"
                  style={input}
                />
                <input
                  name="description"
                  defaultValue={t.description ?? ""}
                  placeholder="Kurzbeschreibung"
                  style={input}
                />
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button style={{ ...button, padding: "6px 12px" }}>Speichern</button>
                  <button
                    formAction={moveTool}
                    name="dir"
                    value="up"
                    disabled={i === 0}
                    style={{ ...ghostSmall, opacity: i === 0 ? 0.4 : 1 }}
                    title="Nach oben"
                  >
                    ↑
                  </button>
                  <button
                    formAction={moveTool}
                    name="dir"
                    value="down"
                    disabled={i === toolList.length - 1}
                    style={{ ...ghostSmall, opacity: i === toolList.length - 1 ? 0.4 : 1 }}
                    title="Nach unten"
                  >
                    ↓
                  </button>
                  <button
                    formAction={deleteTool}
                    style={{ ...ghostSmall, color: "var(--danger)", marginLeft: "auto" }}
                    title="Tool löschen"
                  >
                    Löschen
                  </button>
                </div>
              </form>
            ))}
            {toolList.length === 0 && (
              <Empty>Noch keine Tools. Migration 0027 anwenden, dann anlegen.</Empty>
            )}
          </div>

          {/* Add tool */}
          <form
            action={createTool}
            style={{
              display: "grid",
              gap: 6,
              marginTop: 14,
              borderTop: "1px solid var(--border)",
              paddingTop: 14,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
              Neues Tool
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <input name="icon" placeholder="Icon (Emoji)" style={{ ...input, width: 90, textAlign: "center" }} />
              <input name="name" placeholder="Name (z. B. AWscribe)" required style={{ ...input, width: 180 }} />
              <select name="kind" defaultValue="link" style={{ ...input, width: 120 }}>
                <option value="internal">Intern</option>
                <option value="link">Link</option>
                <option value="embed">Einbetten</option>
              </select>
              <input name="color" placeholder="#579bfc" style={{ ...input, width: 90 }} />
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  color: "var(--muted)",
                }}
              >
                <input type="checkbox" name="enabled" defaultChecked /> Aktiv
              </label>
              <select name="visibility" defaultValue="all" title="Sichtbarkeit" style={{ ...input, width: 150 }}>
                <option value="all">Alle Mitarbeiter</option>
                <option value="admins">Nur Admins</option>
                <option value="marketing">Marketing</option>
                <option value="content">Content</option>
                <option value="grafik">Grafik</option>
              </select>
              <select name="status" defaultValue="active" title="Status" style={{ ...input, width: 130 }}>
                <option value="active">Aktiv</option>
                <option value="maintenance">Wartung</option>
              </select>
            </div>
            <input name="url" placeholder="URL bzw. Pfad" style={input} />
            <input name="description" placeholder="Kurzbeschreibung" style={input} />
            <div>
              <button style={button}>Tool hinzufügen</button>
            </div>
          </form>
        </Section>

              ),
            },
            {
              key: "log",
              label: "Protokoll",
              content: (
        <Section title="Aktivitätsprotokoll">
          {auditRows.length === 0 ? (
            <p style={{ color: "var(--faint)", fontSize: 13, margin: 0 }}>
              Noch keine Einträge (oder Migration 0030 noch nicht angewendet).
            </p>
          ) : (
            <div style={{ display: "grid", gap: 4 }}>
              {auditRows.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "baseline",
                    padding: "7px 4px",
                    borderBottom: "1px solid var(--border)",
                    fontSize: 13,
                  }}
                >
                  <span
                    style={{
                      color: "var(--faint)",
                      fontSize: 12,
                      minWidth: 128,
                      flexShrink: 0,
                    }}
                  >
                    {new Date(a.created_at).toLocaleString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>{a.summary}</span>
                  <span
                    style={{
                      color: "var(--muted)",
                      fontSize: 12,
                      flexShrink: 0,
                    }}
                  >
                    {a.actor_id ? (nameById.get(a.actor_id) ?? "?") : "System"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

              ),
            },
            {
              key: "customers",
              label: "Kunden & Boards",
              content: (
                <>
        <Section title="Kunden & Boards">
          <div style={{ display: "grid", gap: 12 }}>
            {customerList.map((c) => {
              const cb = boardsOfCustomer(c.id);
              return (
                <div
                  key={c.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    background: "var(--panel)",
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      marginBottom: cb.length ? 8 : 6,
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{c.name}</span>
                    <DeleteCustomerButton
                      customerId={c.id}
                      name={c.name}
                      hasBoards={cb.length > 0}
                    />
                  </div>
                  {cb.length > 0 ? (
                    <ul style={{ ...listStyle, margin: 0 }}>{cb.map(boardRow)}</ul>
                  ) : (
                    <form
                      action={createCustomerBoard}
                      style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}
                    >
                      <span style={{ color: "var(--faint)", fontSize: 13 }}>
                        Kein Board angelegt —
                      </span>
                      <input type="hidden" name="customer_id" value={c.id} />
                      <input
                        name="name"
                        defaultValue={c.name}
                        placeholder="Board-Name"
                        required
                        style={{ ...input, flex: "0 1 200px", minWidth: 140 }}
                      />
                      <button style={{ ...button, padding: "6px 12px" }}>
                        Board anlegen
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
            {customerList.length === 0 && <Empty>Noch keine Kunden.</Empty>}
          </div>

          <form action={createCustomer} style={{ ...formRow, marginTop: 12 }}>
            <input name="name" placeholder="Neuer Kundenname" required style={input} />
            <button style={button}>Kunde anlegen</button>
          </form>
        </Section>

        {/* --- Internal boards --- */}
        <Section title="Interne Boards">
          <ul style={listStyle}>
            {internalBoards.map(boardRow)}
            {internalBoards.length === 0 && <Empty>Noch keine internen Boards.</Empty>}
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
        </Section>

                </>
              ),
            },
            {
              key: "users",
              label: "Nutzer",
              content: (
                <>
        <Section title="Nutzer">
          {(() => {
            const all = profiles ?? [];
            const employees = all.filter((p) => p.role === "employee");
            const customers = all.filter((p) => p.role === "customer");
            const renderList = (list: typeof all) => (
              <ul style={listStyle}>
                {list.map((p) => (
                  <UserRow
                    key={p.id}
                    profile={p}
                    email={emailById.get(p.id) ?? null}
                    customers={customerList}
                    isSelf={p.id === ctx.userId}
                  />
                ))}
                {list.length === 0 && <Empty>Niemand.</Empty>}
              </ul>
            );
            return (
              <>
                <div style={subHead}>Mitarbeiter ({employees.length})</div>
                {renderList(employees)}
                <div style={{ ...subHead, marginTop: 16 }}>
                  Kunden ({customers.length})
                </div>
                {renderList(customers)}
              </>
            );
          })()}

          <form action={inviteUser} style={{ display: "grid", gap: 8, marginTop: 16 }}>
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
        <Section title="Team-Import (CSV)">
          <TeamImport />
        </Section>
                </>
              ),
            },
          ]}
        />
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
  margin: "8px 0",
  display: "grid",
  gap: 6,
};

const subHead: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "var(--faint)",
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

const ghostSmall: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "6px 10px",
  color: "var(--muted)",
  fontSize: 13,
  cursor: "pointer",
};
