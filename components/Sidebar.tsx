"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Icon from "@/components/icons";
import type { Board } from "@/lib/types";

const deptLabel: Record<string, string> = {
  marketing: "Marketing",
  content: "Content",
  grafik: "Grafik",
};

export default function Sidebar({
  boards,
  unreadByBoard = {},
  isEmployee = false,
  open = false,
  onClose,
}: {
  boards: Board[];
  unreadByBoard?: Record<string, number>;
  isEmployee?: boolean;
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const match = (b: Board) =>
    !q || b.name.toLowerCase().includes(q.toLowerCase());
  const customer = boards.filter((b) => b.type === "customer" && match(b));
  const internal = boards.filter((b) => b.type === "internal" && match(b));

  const isActive = (id: string) => pathname?.startsWith(`/boards/${id}`);
  const showSearch = boards.length > 6;

  return (
    <aside
      className={`app-sidebar${open ? " open" : ""}`}
      style={{
        width: 240,
        flexShrink: 0,
        borderRight: "1px solid var(--border)",
        background: "var(--sidebar-bg)",
        padding: "16px 10px",
        overflowY: "auto",
      }}
    >
      <a
        href="/my"
        onClick={onClose}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          borderRadius: 8,
          textDecoration: "none",
          color: pathname === "/my" ? "var(--accent)" : "var(--muted)",
          background: pathname === "/my" ? "var(--active)" : "transparent",
          fontSize: 14,
          fontWeight: pathname === "/my" ? 600 : 400,
          marginBottom: 4,
        }}
      >
        <Icon name="check" size={16} />
        Meine Aufgaben
      </a>

      {isEmployee && (
        <a
          href="/agents"
          onClick={onClose}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 8,
            textDecoration: "none",
            color: pathname?.startsWith("/agents")
              ? "var(--accent)"
              : "var(--muted)",
            background: pathname?.startsWith("/agents")
              ? "var(--active)"
              : "transparent",
            fontSize: 14,
            fontWeight: pathname?.startsWith("/agents") ? 600 : 400,
            marginBottom: 4,
          }}
        >
          <Icon name="sparkles" size={16} />
          Agents
        </a>
      )}

      {showSearch && (
        <div style={{ padding: "8px 4px 4px" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Board suchen…"
            style={{
              width: "100%",
              background: "var(--input-bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "7px 10px",
              color: "var(--text)",
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>
      )}

      {customer.length > 0 && (
        <Group
          title="Kunden"
          collapsed={!!collapsed.customer}
          onToggle={() =>
            setCollapsed((c) => ({ ...c, customer: !c.customer }))
          }
        />
      )}
      {!collapsed.customer &&
        customer.map((b) => (
          <BoardLink key={b.id} board={b} active={!!isActive(b.id)} unread={unreadByBoard[b.id] ?? 0} onNavigate={onClose} />
        ))}

      {internal.length > 0 && (
        <Group
          title="Intern"
          collapsed={!!collapsed.internal}
          onToggle={() =>
            setCollapsed((c) => ({ ...c, internal: !c.internal }))
          }
        />
      )}
      {!collapsed.internal &&
        internal.map((b) => (
          <BoardLink key={b.id} board={b} active={!!isActive(b.id)} unread={unreadByBoard[b.id] ?? 0} onNavigate={onClose} />
        ))}

      {q && customer.length === 0 && internal.length === 0 && (
        <p style={{ color: "var(--faint)", fontSize: 13, padding: "8px 10px" }}>
          Keine Treffer.
        </p>
      )}

      {boards.length === 0 && (
        <p style={{ color: "var(--faint)", fontSize: 13, padding: "0 8px" }}>
          Noch keine Boards.
        </p>
      )}
    </aside>
  );
}

function Group({
  title,
  collapsed,
  onToggle,
}: {
  title: string;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        width: "100%",
        background: "transparent",
        border: "none",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        color: "var(--faint)",
        padding: "14px 8px 6px",
        cursor: onToggle ? "pointer" : "default",
        fontWeight: 700,
      }}
    >
      <Icon name={collapsed ? "chevron-right" : "chevron-down"} size={12} />
      {title}
    </button>
  );
}

function BoardLink({
  board,
  active,
  unread = 0,
  onNavigate,
}: {
  board: Board;
  active: boolean;
  unread?: number;
  onNavigate?: () => void;
}) {
  return (
    <a
      href={`/boards/${board.id}`}
      onClick={onNavigate}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 8,
        textDecoration: "none",
        color: active ? "var(--accent)" : "var(--muted)",
        background: active ? "var(--active)" : "transparent",
        fontSize: 14,
        fontWeight: active || unread > 0 ? 600 : 400,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 3,
          flexShrink: 0,
          background: board.type === "internal" ? "#fdab3d" : "#00c875",
        }}
      />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {board.name}
      </span>
      {unread > 0 ? (
        <span
          title={`${unread} ungelesen`}
          style={{
            marginLeft: "auto",
            flexShrink: 0,
            background: "var(--accent)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 999,
            padding: "1px 7px",
            lineHeight: 1.5,
          }}
        >
          {unread}
        </span>
      ) : (
        board.type === "internal" &&
        board.department && (
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--faint)" }}>
            {deptLabel[board.department]}
          </span>
        )
      )}
    </a>
  );
}
