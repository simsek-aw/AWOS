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

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await markNotificationsRead();
      setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={toggle}
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
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 49 }}
          />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "140%",
              width: 320,
              maxHeight: 400,
              overflowY: "auto",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              zIndex: 50,
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            }}
          >
            {items.length === 0 && (
              <p style={{ color: "var(--faint)", fontSize: 14, padding: 16, margin: 0 }}>
                Keine Benachrichtigungen.
              </p>
            )}
            {items.map((n) => {
              let href = "#";
              if (n.board_id && n.task_id) {
                const q = new URLSearchParams({ task: n.task_id });
                if (n.comment_id) q.set("comment", n.comment_id);
                href = `/boards/${n.board_id}?${q.toString()}`;
              } else if (n.board_id) {
                href = `/boards/${n.board_id}`;
              }
              return (
                <a
                  key={n.id}
                  href={href}
                  style={{
                    display: "block",
                    padding: "10px 14px",
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
        </>
      )}
    </div>
  );
}
