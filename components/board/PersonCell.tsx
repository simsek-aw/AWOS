"use client";

import { useRef, useState } from "react";
import { setPeople } from "@/app/(app)/boards/[id]/actions";
import type { Person } from "@/lib/types";
import { Avatar, AvatarStack, EmptyAvatar } from "./Avatar";
import Popover from "./Popover";

function toIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value) return [String(value)];
  return [];
}

export default function PersonCell({
  boardId,
  taskId,
  columnId,
  columnKey,
  value,
  people,
}: {
  boardId: string;
  taskId: string;
  columnId: string;
  columnKey: string;
  value: unknown;
  people: Person[];
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [q, setQ] = useState("");
  const [ids, setIds] = useState<string[]>(() => toIds(value));
  const triggerRef = useRef<HTMLSpanElement>(null);

  const selected = people.filter((p) => ids.includes(p.id));
  const filtered = people.filter((p) =>
    p.name.toLowerCase().includes(q.toLowerCase()),
  );

  const open = () => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    setQ("");
  };

  const toggle = (id: string) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    setIds(next);
    setPeople(boardId, taskId, columnId, columnKey, next);
  };

  return (
    <>
      <span
        ref={triggerRef}
        onClick={open}
        style={{ cursor: "pointer", display: "inline-flex" }}
        title="Zuweisen"
      >
        {selected.length ? (
          <AvatarStack names={selected.map((p) => p.name)} />
        ) : (
          <EmptyAvatar />
        )}
      </span>

      {rect && (
        <Popover rect={rect} width={280} onClose={() => setRect(null)}>
          <div style={{ padding: 8 }}>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Suche nach Namen…"
              style={{
                width: "100%",
                background: "var(--input-bg)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "8px 10px",
                color: "var(--text)",
                fontSize: 14,
              }}
            />
            <div style={{ marginTop: 6 }}>
              {filtered.map((p) => {
                const on = ids.includes(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      cursor: "pointer",
                      borderRadius: 6,
                      background: on ? "var(--active)" : "transparent",
                    }}
                  >
                    <Avatar name={p.name} size={26} />
                    <span style={{ flex: 1, fontSize: 14 }}>{p.name}</span>
                    {on && <span style={{ color: "var(--accent)" }}>✓</span>}
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div style={{ padding: 8, color: "var(--faint)", fontSize: 13 }}>
                  Keine Treffer.
                </div>
              )}
            </div>
          </div>
        </Popover>
      )}
    </>
  );
}
