"use client";

import { usePathname } from "next/navigation";
import type { Board } from "@/lib/types";

const deptLabel: Record<string, string> = {
  marketing: "Marketing",
  content: "Content",
  grafik: "Grafik",
};

export default function Sidebar({ boards }: { boards: Board[] }) {
  const pathname = usePathname();
  const customer = boards.filter((b) => b.type === "customer");
  const internal = boards.filter((b) => b.type === "internal");

  const isActive = (id: string) => pathname?.startsWith(`/boards/${id}`);

  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        borderRight: "1px solid #222834",
        background: "#0c0e13",
        padding: "16px 10px",
        overflowY: "auto",
      }}
    >
      {customer.length > 0 && <Group title="Kunden" />}
      {customer.map((b) => (
        <BoardLink key={b.id} board={b} active={!!isActive(b.id)} />
      ))}

      {internal.length > 0 && <Group title="Intern" />}
      {internal.map((b) => (
        <BoardLink key={b.id} board={b} active={!!isActive(b.id)} />
      ))}

      {boards.length === 0 && (
        <p style={{ color: "#5b6472", fontSize: 13, padding: "0 8px" }}>
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
        color: "#5b6472",
        padding: "14px 8px 6px",
      }}
    >
      {title}
    </div>
  );
}

function BoardLink({ board, active }: { board: Board; active: boolean }) {
  return (
    <a
      href={`/boards/${board.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 8,
        textDecoration: "none",
        color: active ? "#fff" : "var(--muted)",
        background: active ? "#1c2430" : "transparent",
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
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#5b6472" }}>
          {deptLabel[board.department]}
        </span>
      )}
    </a>
  );
}
