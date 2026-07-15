"use client";

import { useEffect, useRef, useState } from "react";
import { setTaskCustomer } from "@/app/(app)/boards/[id]/actions";
import Icon from "@/components/icons";

type Customer = { id: string; name: string };

/**
 * Customer tag for a task on an internal board.
 * - Mirrored tasks (`locked`) show their origin customer read-only.
 * - Manually-created tasks get an editable, searchable customer picker. Setting
 *   it is a plain tag — it never mirrors the task to that customer's board.
 */
export default function CustomerCell({
  boardId,
  taskId,
  customers,
  currentId,
  currentName,
  locked,
}: {
  boardId: string;
  taskId: string;
  customers: Customer[];
  currentId: string | null;
  currentName: string | null;
  locked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [draftId, setDraftId] = useState<string | null>(currentId);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setDraftId(currentId), [currentId]);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  if (locked) {
    return (
      <span
        title="Aus Kundenboard gespiegelt"
        style={{ color: "var(--muted)", fontSize: 13 }}
      >
        {currentName ?? "—"}
      </span>
    );
  }

  const selected = customers.find((c) => c.id === draftId) ?? null;
  const filtered = q
    ? customers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
    : customers;

  const pick = (id: string | null) => {
    setDraftId(id);
    setOpen(false);
    setQ("");
    setTaskCustomer(boardId, taskId, id);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          maxWidth: "100%",
          background: selected ? "var(--active)" : "transparent",
          border: `1px solid ${selected ? "transparent" : "var(--border)"}`,
          borderRadius: 999,
          padding: selected ? "3px 10px" : "3px 10px",
          color: selected ? "var(--text)" : "var(--faint)",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={selected ? selected.name : "Kunde zuordnen"}
      >
        {selected ? (
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {selected.name}
          </span>
        ) : (
          <>
            <Icon name="plus" size={12} /> Kunde
          </>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "130%",
            width: 220,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            zIndex: 60,
            boxShadow: "0 12px 34px rgba(0,0,0,0.5)",
            padding: 8,
          }}
        >
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Kunde suchen…"
            style={{
              width: "100%",
              background: "var(--input-bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "7px 9px",
              color: "var(--text)",
              fontSize: 13,
            }}
          />
          <div style={{ marginTop: 6, maxHeight: 240, overflowY: "auto" }}>
            <button
              onClick={() => pick(null)}
              style={{
                ...item,
                color: draftId ? "var(--muted)" : "var(--accent)",
              }}
            >
              Kein Kunde
            </button>
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => pick(c.id)}
                style={{
                  ...item,
                  background: c.id === draftId ? "var(--active)" : "transparent",
                }}
              >
                {c.name}
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: 8, color: "var(--faint)", fontSize: 13 }}>
                Keine Treffer.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const item: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "transparent",
  border: "none",
  borderRadius: 6,
  padding: "7px 9px",
  color: "var(--text)",
  fontSize: 13,
  cursor: "pointer",
};
