"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/icons";

type Recent = { id: string; name: string; type: string };

// "Zuletzt besucht" section on the dashboard, read from localStorage (written
// by RecentBoardTracker on each board visit). Renders nothing until it has
// data, so it never flashes an empty box.
export default function RecentBoards() {
  const [items, setItems] = useState<Recent[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("awos-board-recents");
      setItems(raw ? (JSON.parse(raw) as Recent[]) : []);
    } catch {
      setItems([]);
    }
  }, []);

  const list = items.slice(0, 6);
  if (list.length === 0) return null;

  return (
    <section style={{ marginTop: 26 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>Zuletzt besucht</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        {list.map((b) => (
          <a
            key={b.id}
            href={`/boards/${b.id}`}
            className="lift"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderLeft: `3px solid ${b.type === "internal" ? "#fdab3d" : "#00c875"}`,
              borderRadius: 12,
              padding: "12px 14px",
              textDecoration: "none",
              color: "var(--text)",
            }}
          >
            <span
              style={{
                color: "var(--faint)",
                display: "inline-flex",
                flexShrink: 0,
              }}
            >
              <Icon name="group" size={16} />
            </span>
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {b.name}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
