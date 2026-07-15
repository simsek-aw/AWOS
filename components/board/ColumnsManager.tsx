"use client";

import { useState, useTransition } from "react";
import {
  addColumn,
  deleteColumn,
  moveColumn,
  renameColumn,
} from "@/app/(app)/boards/[id]/actions";
import Icon from "@/components/icons";
import type { Column } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  text: "Text",
  person: "Person",
  status: "Status",
  date: "Datum",
  link: "Link",
  number: "Zahl",
};
const ADD_TYPES = ["text", "status", "date", "person", "link", "number"];
const PROTECTED = new Set(["task_id", "name"]);

// Employee-only column management: rename, reorder, delete, and add columns.
export default function ColumnsManager({
  boardId,
  columns,
}: {
  boardId: string;
  columns: Column[];
}) {
  const [pending, start] = useTransition();
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState("text");

  const ordered = [...columns].sort((a, b) => a.position - b.position);

  return (
    <div style={{ padding: 10, display: "grid", gap: 8, opacity: pending ? 0.7 : 1 }}>
      <div style={head}>Spalten</div>

      <div style={{ display: "grid", gap: 4, maxHeight: 280, overflowY: "auto" }}>
        {ordered.map((c, i) => (
          <div
            key={c.id}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            <input
              defaultValue={c.label}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== c.label)
                  start(() => renameColumn(boardId, c.id, v));
              }}
              style={{
                flex: 1,
                minWidth: 0,
                background: "var(--input-bg)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "6px 8px",
                color: "var(--text)",
                fontSize: 13,
              }}
            />
            <span style={{ fontSize: 11, color: "var(--faint)", width: 44 }}>
              {TYPE_LABELS[c.type] ?? c.type}
            </span>
            <button
              onClick={() => start(() => moveColumn(boardId, c.id, -1))}
              disabled={i === 0}
              title="Nach oben"
              style={iconBtn(i === 0)}
            >
              <Icon name="chevron-left" size={14} style={{ transform: "rotate(90deg)" }} />
            </button>
            <button
              onClick={() => start(() => moveColumn(boardId, c.id, 1))}
              disabled={i === ordered.length - 1}
              title="Nach unten"
              style={iconBtn(i === ordered.length - 1)}
            >
              <Icon name="chevron-right" size={14} style={{ transform: "rotate(90deg)" }} />
            </button>
            <button
              onClick={() => {
                if (confirm(`Spalte „${c.label}" löschen? Werte gehen verloren.`))
                  start(() => deleteColumn(boardId, c.id));
              }}
              disabled={PROTECTED.has(c.key)}
              title={PROTECTED.has(c.key) ? "Kernspalte" : "Löschen"}
              style={{ ...iconBtn(PROTECTED.has(c.key)), color: "var(--danger)" }}
            >
              <Icon name="trash" size={14} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}>
        <div style={{ ...head, marginBottom: 6 }}>Neue Spalte</div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newLabel.trim()) {
                start(() => addColumn(boardId, newLabel, newType));
                setNewLabel("");
              }
            }}
            placeholder="Bezeichnung"
            style={{
              flex: 1,
              minWidth: 0,
              background: "var(--input-bg)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "7px 9px",
              color: "var(--text)",
              fontSize: 13,
            }}
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            style={{
              background: "var(--input-bg)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "7px 6px",
              color: "var(--text)",
              fontSize: 13,
            }}
          >
            {ADD_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {
            if (newLabel.trim()) {
              start(() => addColumn(boardId, newLabel, newType));
              setNewLabel("");
            }
          }}
          disabled={!newLabel.trim() || pending}
          style={{
            marginTop: 8,
            width: "100%",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Spalte hinzufügen
        </button>
      </div>
    </div>
  );
}

const head: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "var(--faint)",
  fontWeight: 700,
};

const iconBtn = (disabled: boolean): React.CSSProperties => ({
  background: "transparent",
  border: "none",
  color: "var(--muted)",
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.3 : 1,
  display: "inline-flex",
  padding: 2,
});
