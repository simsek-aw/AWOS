"use client";

import { useState } from "react";
import { setCellValue, updateColumnOptions } from "@/app/(app)/boards/[id]/actions";
import type { Column, StatusOption } from "@/lib/types";

const PALETTE = [
  "#00c875", "#579bfc", "#a25ddc", "#e2445c", "#fdab3d", "#ff642e",
  "#9cd326", "#66ccff", "#ff5ac4", "#037f4c", "#0086c0", "#333333",
];

export default function StatusCell({
  boardId,
  taskId,
  column,
  value,
  canEditLabels,
}: {
  boardId: string;
  taskId: string;
  column: Column;
  value: unknown;
  canEditLabels: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const options: StatusOption[] = column.options.options ?? [];
  const current = value == null ? "" : String(value);
  const color = options.find((o) => o.label === current)?.color ?? "transparent";

  const pick = (label: string) => {
    setOpen(false);
    setCellValue(boardId, taskId, column.id, column.key, label);
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => {
          setOpen(true);
          setEditing(false);
        }}
        style={{
          width: "100%",
          height: 40,
          border: "none",
          background: current ? color : "transparent",
          color: current ? "#fff" : "var(--muted)",
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        {current || "—"}
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 49 }}
          />
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 50,
              width: 320,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              boxShadow: "var(--shadow)",
              padding: 12,
            }}
          >
            {!editing ? (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  {options.map((o) => (
                    <button
                      key={o.label}
                      onClick={() => pick(o.label)}
                      style={{
                        background: o.color,
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        padding: "10px 8px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                  <button
                    onClick={() => pick("")}
                    style={{
                      background: "var(--surface-2)",
                      color: "var(--muted)",
                      border: "none",
                      borderRadius: 6,
                      padding: "10px 8px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Leeren
                  </button>
                </div>
                {canEditLabels && (
                  <button
                    onClick={() => setEditing(true)}
                    style={{
                      marginTop: 12,
                      background: "transparent",
                      border: "none",
                      color: "var(--muted)",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    ✏️ Labels bearbeiten
                  </button>
                )}
              </>
            ) : (
              <LabelEditor
                boardId={boardId}
                column={column}
                options={options}
                onDone={() => {
                  setEditing(false);
                  setOpen(false);
                }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function LabelEditor({
  boardId,
  column,
  options,
  onDone,
}: {
  boardId: string;
  column: Column;
  options: StatusOption[];
  onDone: () => void;
}) {
  const [items, setItems] = useState<StatusOption[]>(
    options.length ? options : [{ label: "", color: PALETTE[0] }],
  );
  const [saving, setSaving] = useState(false);

  const patch = (i: number, p: Partial<StatusOption>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  const add = () =>
    setItems((prev) => [
      ...prev,
      { label: "", color: PALETTE[prev.length % PALETTE.length] },
    ]);
  const del = (i: number) =>
    setItems((prev) => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true);
    await updateColumnOptions(boardId, column.id, items);
    onDone();
  };

  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
        Labels bearbeiten
      </div>
      <div style={{ display: "grid", gap: 6, maxHeight: 260, overflowY: "auto" }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="color"
              value={it.color}
              onChange={(e) => patch(i, { color: e.target.value })}
              style={{
                width: 34,
                height: 30,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 0,
              }}
            />
            <input
              value={it.label}
              onChange={(e) => patch(i, { label: e.target.value })}
              placeholder="Label"
              style={{
                flex: 1,
                background: "var(--input-bg)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "6px 8px",
                color: "var(--text)",
                fontSize: 13,
              }}
            />
            <button
              onClick={() => del(i)}
              title="Löschen"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--danger)",
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={add}
        style={{
          marginTop: 8,
          background: "transparent",
          border: "1px dashed var(--border)",
          color: "var(--muted)",
          borderRadius: 6,
          padding: "6px 10px",
          fontSize: 13,
          cursor: "pointer",
          width: "100%",
        }}
      >
        + Label
      </button>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Speichern
        </button>
        <button
          onClick={onDone}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--muted)",
            borderRadius: 8,
            padding: "8px 16px",
            cursor: "pointer",
          }}
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
