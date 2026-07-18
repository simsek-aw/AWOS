import { markNotificationsRead } from "@/app/(app)/boards/[id]/actions";
import { requireSession } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Notification } from "@/lib/types";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  assignment: "Zuweisung",
  mention: "Erwähnung",
  new_task: "Neue Aufgabe",
  comment: "Kommentar",
  reaction: "Reaktion",
  due_soon: "Bald fällig",
  overdue: "Überfällig",
  stale: "Inaktiv",
  status: "Status",
  digest: "Tagesüberblick",
  board_health: "Board-Report",
};

function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "gerade eben";
  if (s < 3600) return `vor ${Math.floor(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std.`;
  return `vor ${Math.floor(s / 86400)} Tg.`;
}

function hrefFor(n: Notification): string {
  if (n.board_id && n.task_id) {
    const q = new URLSearchParams({ task: n.task_id });
    if (n.comment_id) q.set("comment", n.comment_id);
    return `/boards/${n.board_id}?${q.toString()}`;
  }
  if (n.board_id) return `/boards/${n.board_id}`;
  return "#";
}

export default async function NotificationsPage() {
  const ctx = await requireSession();
  const supabase = await createServerSupabase();
  const { data: items } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<Notification[]>();

  const list = items ?? [];
  const unread = list.filter((n) => !n.read).length;

  return (
    <div className="page-pad page-enter" style={{ padding: "24px 28px", maxWidth: 720 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          Benachrichtigungen
        </h1>
        {unread > 0 && (
          <form action={markNotificationsRead}>
            <button
              type="submit"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "7px 12px",
                color: "var(--text)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Alle als gelesen ({unread})
            </button>
          </form>
        )}
      </div>

      {list.length === 0 && (
        <p style={{ color: "var(--faint)" }}>Keine Benachrichtigungen.</p>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {list.map((n) => (
          <a
            key={n.id}
            href={hrefFor(n)}
            style={{
              display: "block",
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: n.read ? "var(--surface)" : "var(--active)",
              textDecoration: "none",
              color: "var(--text)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 14, lineHeight: 1.4 }}>{n.body}</div>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--faint)",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {ago(n.created_at)}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
              {LABELS[n.type] ?? "Benachrichtigung"}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
