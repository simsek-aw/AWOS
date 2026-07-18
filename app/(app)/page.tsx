import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { deadlineUrgency, formatDate } from "@/lib/format";
import { createServerSupabase } from "@/lib/supabase/server";
import { personTaskRows } from "@/lib/tasks";
import { listTools } from "@/lib/tools";
import type { Tool } from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import { statusPillStyle } from "@/components/board/pills";

const isDone = (s: string) => /fertig|done|erledigt|abgeschlossen/i.test(s);
const daysUntil = (iso: string): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
};

// AWOS platform home = a personal work dashboard + tool launcher. Customers only
// have the CMS, so they go straight to their boards.
export default async function Home() {
  const ctx = await requireSession();
  if (ctx.profile.role !== "employee") redirect("/boards");

  const supabase = await createServerSupabase();
  const [myTasks, unreadRes, eventsRes, tools] = await Promise.all([
    personTaskRows(supabase, ctx.userId).catch(() => []),
    supabase.rpc("unread_counts"),
    supabase
      .from("task_events")
      .select("id, task_id, actor_id, kind, summary, created_at")
      .order("created_at", { ascending: false })
      .limit(15)
      .returns<
        {
          id: string;
          task_id: string;
          actor_id: string | null;
          kind: string;
          summary: string;
          created_at: string;
        }[]
      >(),
    listTools({
      department: ctx.profile.department,
      isAdmin: ctx.profile.is_admin ?? true,
    }),
  ]);

  const unread = ((unreadRes.data ?? []) as { cnt: number }[]).reduce(
    (a, r) => a + Number(r.cnt),
    0,
  );

  const open = myTasks.filter((t) => !isDone(t.status));
  const overdue = open.filter(
    (t) => t.deadline && (daysUntil(t.deadline) ?? 99) < 0,
  );
  const thisWeek = open.filter((t) => {
    const d = t.deadline ? daysUntil(t.deadline) : null;
    return d != null && d >= 0 && d <= 7;
  });

  // Enrich the activity feed with task titles/boards + actor names (drop events
  // whose task is gone/trashed).
  const events = eventsRes.data ?? [];
  const taskIds = [...new Set(events.map((e) => e.task_id))];
  const actorIds = [...new Set(events.map((e) => e.actor_id).filter(Boolean))] as string[];
  const [tasksRes, boardsRes, actorsRes] = await Promise.all([
    taskIds.length
      ? supabase
          .from("tasks")
          .select("id, title, board_id")
          .in("id", taskIds)
          .is("archived_at", null)
          .is("deleted_at", null)
          .returns<{ id: string; title: string; board_id: string }[]>()
      : Promise.resolve({ data: [] as { id: string; title: string; board_id: string }[] }),
    supabase.from("boards").select("id, name").returns<{ id: string; name: string }[]>(),
    actorIds.length
      ? supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", actorIds)
          .returns<{ id: string; full_name: string | null }[]>()
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
  ]);
  const taskById = new Map((tasksRes.data ?? []).map((t) => [t.id, t]));
  const boardName = new Map((boardsRes.data ?? []).map((b) => [b.id, b.name]));
  const actorName = new Map((actorsRes.data ?? []).map((a) => [a.id, a.full_name ?? "?"]));
  const feed = events
    .map((e) => {
      const t = taskById.get(e.task_id);
      if (!t) return null;
      return { ...e, task: t };
    })
    .filter(Boolean)
    .slice(0, 8) as (typeof events[number] & {
    task: { id: string; title: string; board_id: string };
  })[];

  const first = ctx.profile.full_name?.split(" ")[0] ?? "";

  const hrefFor = (t: Tool): string | undefined => {
    if (t.status === "maintenance" || !t.enabled) return undefined;
    if (t.kind === "internal") return t.url ?? "/";
    if (t.kind === "embed") return `/tools/${t.key}`;
    return t.url ?? undefined;
  };

  const today = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div
      className="page-enter page-pad"
      style={{ maxWidth: 1000, margin: "0 auto", padding: "36px 28px" }}
    >
      <p
        style={{
          color: "var(--faint)",
          fontSize: 13,
          fontWeight: 600,
          textTransform: "capitalize",
          margin: "0 0 4px",
        }}
      >
        {today}
      </p>
      <h1
        className="dashboard-hero-title"
        style={{ fontSize: 30, margin: 0, letterSpacing: -0.5 }}
      >
        {greeting()}
        {first ? ", " : ""}
        <span className="text-gradient">{first}</span>
      </h1>
      <p style={{ color: "var(--muted)", marginTop: 6 }}>
        Dein Überblick für heute.
      </p>

      {/* Stat tiles */}
      <div
        className="stat-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 12,
          marginTop: 20,
        }}
      >
        <Stat label="Offene Aufgaben" value={open.length} href="/my" />
        <Stat label="Fällig (7 Tage)" value={thisWeek.length} href="/my" tone={thisWeek.length ? "amber" : undefined} />
        <Stat label="Überfällig" value={overdue.length} href="/my" tone={overdue.length ? "red" : undefined} />
        <Stat label="Ungelesen" value={unread} href="/notifications" tone={unread ? "accent" : undefined} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)",
          gap: 20,
          marginTop: 24,
          alignItems: "start",
        }}
        className="dashboard-grid"
      >
        {/* My tasks */}
        <section>
          <div style={sectionHead}>
            <h2 style={h2}>Meine Aufgaben</h2>
            <a href="/my" style={moreLink}>
              Alle →
            </a>
          </div>
          {open.length === 0 ? (
            <EmptyState
              variant="tasks"
              compact
              title="Keine offenen Aufgaben"
              hint="Lehn dich zurück – du bist auf dem neuesten Stand."
            />
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {open.slice(0, 8).map((t) => {
                const urg =
                  t.deadline && !isDone(t.status)
                    ? deadlineUrgency(t.deadline)
                    : null;
                return (
                  <a
                    key={t.id}
                    href={`/boards/${t.board_id}?task=${t.id}`}
                    className="lift"
                    style={rowCard}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={rowTitle}>{t.title}</span>
                      <span style={rowSub}>{t.boardName}</span>
                    </span>
                    {t.status && (
                      <span style={{ ...statusPillStyle(t.statusColor), flexShrink: 0 }}>
                        {t.status}
                      </span>
                    )}
                    {t.deadline && (
                      <span
                        style={{
                          fontSize: 12,
                          color: urg?.tone === "red" ? "var(--danger)" : "var(--muted)",
                          flexShrink: 0,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {urg ? urg.label : formatDate(t.deadline)}
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          )}
        </section>

        {/* Activity feed */}
        <section>
          <div style={sectionHead}>
            <h2 style={h2}>Aktivität</h2>
          </div>
          {feed.length === 0 ? (
            <EmptyState
              variant="activity"
              compact
              title="Noch keine Aktivität"
              hint="Änderungen an Aufgaben erscheinen hier."
            />
          ) : (
            <div style={{ display: "grid", gap: 2 }}>
              {feed.map((e) => (
                <a
                  key={e.id}
                  href={`/boards/${e.task.board_id}?task=${e.task.id}`}
                  style={{
                    display: "block",
                    padding: "8px 10px",
                    borderRadius: 8,
                    textDecoration: "none",
                    color: "var(--text)",
                  }}
                  className="search-result"
                >
                  <div style={{ fontSize: 13 }}>
                    <strong>{e.actor_id ? actorName.get(e.actor_id) ?? "?" : "System"}</strong>{" "}
                    <span style={{ color: "var(--muted)" }}>{e.summary}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--faint)" }}>
                    {e.task.title} · {boardName.get(e.task.board_id) ?? "Board"} ·{" "}
                    {ago(e.created_at)}
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Tool launcher */}
      <h2 style={{ ...h2, marginTop: 34 }}>Tools</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 14,
          marginTop: 12,
        }}
      >
        {tools.map((t) => {
          const href = hrefFor(t);
          const external = t.kind === "link";
          const maintenance = t.status === "maintenance";
          const badge = maintenance ? "Wartung" : !href ? "Bald" : null;
          const color = t.color ?? "#579bfc";
          const inner = (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    background: color + "22",
                    border: `1px solid ${color}55`,
                  }}
                >
                  {t.icon || t.name.slice(0, 2)}
                </span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontWeight: 700,
                    fontSize: 15,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {t.name}
                  {badge && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 0.4,
                        color: maintenance ? "#fdab3d" : "var(--muted)",
                        background: "var(--surface-2)",
                        border: `1px solid ${maintenance ? "#fdab3d55" : "var(--border)"}`,
                        borderRadius: 999,
                        padding: "1px 7px",
                      }}
                    >
                      {badge}
                    </span>
                  )}
                </div>
                {href && (
                  <span
                    className="reveal-arrow-icon"
                    aria-hidden
                    style={{
                      marginLeft: "auto",
                      fontSize: 16,
                      color,
                      flexShrink: 0,
                    }}
                  >
                    →
                  </span>
                )}
              </div>
              <p style={{ color: "var(--muted)", fontSize: 13, margin: "10px 0 0" }}>
                {t.description ?? ""}
              </p>
            </>
          );
          const base: React.CSSProperties = {
            display: "block",
            position: "relative",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderTop: `3px solid ${href ? color : "var(--border)"}`,
            borderRadius: 14,
            padding: 16,
            textDecoration: "none",
            color: "var(--text)",
            opacity: href ? 1 : 0.6,
          };
          if (!href)
            return (
              <div key={t.key} style={{ ...base, cursor: "default" }}>
                {inner}
              </div>
            );
          return (
            <a
              key={t.key}
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              className="lift reveal-arrow"
              style={base}
            >
              {inner}
            </a>
          );
        })}
      </div>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Hallo";
  return "Guten Abend";
}

function ago(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "gerade eben";
  if (s < 3600) return `vor ${Math.floor(s / 60)} min`;
  if (s < 86400) return `vor ${Math.floor(s / 3600)} h`;
  return `vor ${Math.floor(s / 86400)} T`;
}

function Stat({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  tone?: "red" | "amber" | "accent";
}) {
  const color =
    tone === "red"
      ? "var(--danger)"
      : tone === "amber"
        ? "#fdab3d"
        : tone === "accent"
          ? "var(--accent)"
          : "var(--text)";
  const accent =
    tone === "red"
      ? "var(--danger)"
      : tone === "amber"
        ? "#fdab3d"
        : tone === "accent"
          ? "var(--accent)"
          : "var(--border)";
  return (
    <a
      href={href}
      className="lift"
      style={{
        display: "block",
        position: "relative",
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${accent}`,
        borderRadius: 12,
        padding: "16px 16px 16px 18px",
        textDecoration: "none",
        overflow: "hidden",
      }}
    >
      <div style={{ fontSize: 30, fontWeight: 800, color, letterSpacing: -0.5 }}>
        {value}
      </div>
      <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>
        {label}
      </div>
    </a>
  );
}

const h2: React.CSSProperties = { fontSize: 16, margin: 0 };
const sectionHead: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  marginBottom: 10,
};
const moreLink: React.CSSProperties = {
  fontSize: 13,
  color: "var(--accent)",
  textDecoration: "none",
};
const rowCard: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "9px 12px",
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  textDecoration: "none",
  color: "var(--text)",
};
const rowTitle: React.CSSProperties = {
  display: "block",
  fontSize: 14,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const rowSub: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--muted)",
};
