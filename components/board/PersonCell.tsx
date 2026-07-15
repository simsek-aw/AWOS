"use client";

import { useState } from "react";
import { setPeople } from "@/app/(app)/boards/[id]/actions";
import type { Person } from "@/lib/types";
import { Avatar, AvatarStack, EmptyAvatar } from "./Avatar";

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
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [ids, setIds] = useState<string[]>(() => toIds(value));

  const selected = people.filter((p) => ids.includes(p.id));
  const filtered = people.filter((p) =>
    p.name.toLowerCase().includes(q.toLowerCase()),
  );

  const toggle = (id: string) => {
    const next = ids.includes(id)
      ? ids.filter((x) => x !== id)
      : [...ids, id];
    setIds(next);
    setPeople(boardId, taskId, columnId, columnKey, next);
  };

  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <span
        onClick={() => setOpen(true)}
        style={{ cursor: "pointer", display: "inline-flex" }}
        title="Zuweisen"
      >
        {selected.length ? (
          <AvatarStack names={selected.map((p) => p.name)} />
        ) : (
          <EmptyAvatar />
        )}
      </span>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 49 }}
          />
          <div
            style={{
              position: "absolute",
              top: "110%",
              left: 0,
              zIndex: 50,
              width: 280,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              boxShadow: "var(--shadow)",
              padding: 8,
              textAlign: "left",
            }}
          >
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
            <div style={{ maxHeight: 240, overflowY: "auto", marginTop: 6 }}>
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
        </>
      )}
    </span>
  );
}
