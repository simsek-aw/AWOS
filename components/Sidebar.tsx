"use client";

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
  const customer = boards.filter((b) => b.type === "customer");
  const internal = boards.filter((b) => b.type === "internal");

  const isActive = (id: string) => pathname?.startsWith(`/boards/${id}`);

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

      {customer.length > 0 && <Group title="Kunden" />}
      {customer.map((b) => (
        <BoardLink key={b.id} board={b} active={!!isActive(b.id)} unread={unreadByBoard[b.id] ?? 0} onNavigate={onClose} />
      ))}

      {internal.length > 0 && <Group title="Intern" />}
      {internal.map((b) => (
        <BoardLink key={b.id} board={b} active={!!isActive(b.id)} unread={unreadByBoard[b.id] ?? 0} onNavigate={onClose} />
      ))}

      {boards.length === 0 && (
        <p style={{ color: "var(--faint)", fontSize: 13, padding: "0 8px" }}>
          Noch keine Boards.
        </p>
      )}
    </aside>
  );
}

function Group({ title }: { title: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        color: "var(--faint)",
        padding: "14px 8px 6px",
      }}
    >
      {title}
    </div>
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
