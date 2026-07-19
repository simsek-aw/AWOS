"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/icons";
import {
  SectionCard,
  boardChipGrid,
  boardChipName,
  boardChipStyle,
} from "@/components/Section";

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
    <SectionCard
      title="Zuletzt besucht"
      icon={<Icon name="group" size={16} />}
      bodyGap={0}
      style={{ marginTop: 16 }}
    >
      <div style={boardChipGrid}>
        {list.map((b) => (
          <a
            key={b.id}
            href={`/boards/${b.id}`}
            className="lift"
            style={boardChipStyle(b.type)}
          >
            <span style={{ color: "var(--faint)", display: "inline-flex", flexShrink: 0 }}>
              <Icon name="group" size={15} />
            </span>
            <span style={boardChipName}>{b.name}</span>
          </a>
        ))}
      </div>
    </SectionCard>
  );
}
