"use client";

import { usePathname } from "next/navigation";
import type { Board } from "@/lib/types";

const deptLabel: Record<string, string> = {
  marketing: "Marketing",
  content: "Content",
  grafik: "Grafik",
};

export default function Sidebar({
  boards,
  open = false,
  onClose,
}: {
  boards: Board[];
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
      {customer.length > 0 && <Group title="Kunden" />}
      {customer.map((b) => (
        <BoardLink key={b.id} board={b} active={!!isActive(b.id)} onNavigate={onClose} />
      ))}

      {internal.length > 0 && <Group title="Intern" />}
      {internal.map((b) => (
        <BoardLink key={b.id} board={b} active={!!isActive(b.id)} onNavigate={onClose} />
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
  onNavigate,
}: {
  board: Board;
  active: boolean;
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
        fontWeight: active ? 600 : 400,
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
      {board.type === "internal" && board.department && (
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--faint)" }}>
          {deptLabel[board.department]}
        </span>
      )}
    </a>
  );
}
