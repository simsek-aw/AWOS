import { createServerSupabase } from "@/lib/supabase/server";
import type { Board } from "@/lib/types";

const deptLabel: Record<string, string> = {
  marketing: "Marketing",
  content: "Content",
  grafik: "Grafik",
};

// AWcms home: overview of the boards the user can access (RLS-scoped). Shown
// with the board sidebar.
export default async function BoardsOverview() {
  const supabase = await createServerSupabase();

  const { data: boards } = await supabase
    .from("boards")
    .select("*")
    .order("type", { ascending: true })
    .order("name", { ascending: true })
    .returns<Board[]>();

  const active = (boards ?? []).filter((b) => !b.archived_at);
  const internal = active.filter((b) => b.type === "internal");
  const customer = active.filter((b) => b.type === "customer");

  return (
    <div style={{ maxWidth: 960, padding: "32px 28px" }}>
      <h1 style={{ fontSize: 26, marginTop: 0 }}>Boards</h1>
      <p style={{ color: "var(--muted)", marginTop: -4 }}>
        Wähle links ein Board oder starte hier.
      </p>

      {(boards ?? []).length === 0 && (
        <p style={{ color: "var(--muted)" }}>
          Noch keine Boards sichtbar. Ein Mitarbeiter muss dir Zugriff geben.
        </p>
      )}

      {customer.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={sectionTitle}>Kunden-Boards</h2>
          <div style={grid}>
            {customer.map((b) => (
              <BoardCard key={b.id} board={b} />
            ))}
          </div>
        </section>
      )}

      {internal.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={sectionTitle}>Intern</h2>
          <div style={grid}>
            {internal.map((b) => (
              <BoardCard key={b.id} board={b} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function BoardCard({ board }: { board: Board }) {
  return (
    <a href={`/boards/${board.id}`} style={cardStyle}>
      <div style={{ fontWeight: 600 }}>{board.name}</div>
      <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
        {board.type === "internal"
          ? board.department
            ? deptLabel[board.department]
            : "Intern"
          : "Kunde"}
      </div>
    </a>
  );
}

const sectionTitle: React.CSSProperties = {
  fontSize: 14,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "var(--muted)",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: 12,
  marginTop: 12,
};

const cardStyle: React.CSSProperties = {
  display: "block",
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: 16,
  textDecoration: "none",
  color: "var(--text)",
};
