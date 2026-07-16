"use client";

import { useEffect, useState } from "react";
import { markNotificationsRead } from "@/app/(app)/boards/[id]/actions";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/lib/types";
import Icon from "./icons";

function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "gerade eben";
  if (s < 3600) return `vor ${Math.floor(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std.`;
  return `vor ${Math.floor(s / 86400)} Tg.`;
}

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

export default function NotificationBell({ userId }: { userId: string }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [q, setQ] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30)
        .returns<Notification[]>();
      setItems(data ?? []);
    };

    let ch: ReturnType<typeof supabase.channel> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    (async () => {
      // Authorize the realtime socket with the user's JWT, otherwise RLS
      // (user_id = auth.uid()) filters out every event and nothing arrives live.
      const { data: s } = await supabase.auth.getSession();
      if (s.session?.access_token) {
        supabase.realtime.setAuth(s.session.access_token);
      }
      await load();
      ch = supabase
        .channel(`notif-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          () => load(),
        )
        .subscribe();
      // Safety net: a slow refresh every 30s in case a realtime event is missed.
      poll = setInterval(load, 30000);
    })();

    return () => {
      if (ch) supabase.removeChannel(ch);
      if (poll) clearInterval(poll);
    };
  }, [userId]);

  const unread = items.filter((i) => !i.read).length;

  const openPanel = async () => {
    setOpen(true);
    requestAnimationFrame(() => setShown(true));
    if (unread > 0) {
      await markNotificationsRead();
      // Keep the unread styling until the panel is reopened, so the user still
      // sees what was new; mark server-side read immediately though.
    }
  };
  const closePanel = () => {
    setShown(false);
    setTimeout(() => {
      setOpen(false);
      // Reflect read state after closing.
      setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    }, 240);
  };

  const filtered = items.filter(
    (n) =>
      (!unreadOnly || !n.read) &&
      (!q || n.body.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={openPanel}
        title="Benachrichtigungen"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: 16,
          position: "relative",
          padding: 4,
          display: "inline-flex",
          alignItems: "center",
          color: unread > 0 ? "var(--accent)" : "var(--text)",
          animation: unread > 0 ? "awos-bell 1.6s ease-in-out infinite" : "none",
        }}
      >
        <Icon name="bell" size={18} />
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -4,
              background: "var(--danger)",
              color: "#fff",
              borderRadius: 10,
              fontSize: 10,
              fontWeight: 700,
              padding: "1px 5px",
              lineHeight: 1.4,
            }}
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            onClick={closePanel}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 90,
              opacity: shown ? 1 : 0,
              transition: "opacity 240ms ease",
            }}
          />
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(400px, 100%)",
              background: "var(--surface)",
              borderLeft: "1px solid var(--border)",
              zIndex: 91,
              display: "flex",
              flexDirection: "column",
              transform: shown ? "translateX(0)" : "translateX(100%)",
              transition: "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)",
              boxShadow: "-12px 0 40px rgba(0,0,0,0.35)",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <strong style={{ fontSize: 15 }}>Benachrichtigungen</strong>
              <button
                onClick={closePanel}
                title="Schließen"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--muted)",
                  cursor: "pointer",
                  display: "inline-flex",
                }}
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            {/* Search + unread toggle */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flex: 1,
                  background: "var(--input-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0 8px",
                  height: 34,
                }}
              >
                <span style={{ color: "var(--faint)", display: "inline-flex" }}>
                  <Icon name="search" size={15} />
                </span>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Suchen…"
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "var(--text)",
                    fontSize: 13,
                  }}
                />
              </div>
              <button
                onClick={() => setUnreadOnly((v) => !v)}
                title="Nur ungelesene zeigen"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: unreadOnly ? "var(--active)" : "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0 10px",
                  height: 34,
                  color: unreadOnly ? "var(--text)" : "var(--muted)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Nur ungelesene
              </button>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {filtered.length === 0 && (
                <p style={{ color: "var(--faint)", fontSize: 14, padding: 16, margin: 0 }}>
                  {items.length === 0
                    ? "Keine Benachrichtigungen."
                    : "Keine Treffer."}
                </p>
              )}
              {filtered.map((n) => {
                let href = "#";
                if (n.board_id && n.task_id) {
                  const p = new URLSearchParams({ task: n.task_id });
                  if (n.comment_id) p.set("comment", n.comment_id);
                  href = `/boards/${n.board_id}?${p.toString()}`;
                } else if (n.board_id) {
                  href = `/boards/${n.board_id}`;
                }
                return (
                  <a
                    key={n.id}
                    href={href}
                    style={{
                      display: "block",
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--border)",
                      textDecoration: "none",
                      color: "var(--text)",
                      background: n.read ? "transparent" : "var(--active)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <div style={{ fontSize: 13, lineHeight: 1.4 }}>{n.body}</div>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 11,
                          color: "var(--faint)",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {ago(n.created_at)}
                        {!n.read && (
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: "var(--accent)",
                            }}
                          />
                        )}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      {LABELS[n.type] ?? "Benachrichtigung"}
                    </div>
                  </a>
                );
              })}
            </div>

            {/* Footer */}
            <a
              href="/notifications"
              onClick={closePanel}
              style={{
                display: "block",
                textAlign: "center",
                padding: "12px 16px",
                borderTop: "1px solid var(--border)",
                color: "var(--accent)",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Alle ansehen
            </a>
          </div>
        </>
      )}
    </div>
  );
}
