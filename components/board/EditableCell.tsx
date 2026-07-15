"use client";

import { useState, useTransition } from "react";
import {
  renameTask,
  setCellValue,
} from "@/app/(app)/boards/[id]/actions";
import { shortId } from "@/components/columns";
import type { Column, Person, StatusOption, Task } from "@/lib/types";

export default function EditableCell({
  boardId,
  task,
  column,
  value,
  people = [],
}: {
  boardId: string;
  task: Task;
  column: Column;
  value: unknown;
  people?: Person[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  // Task-ID: read-only.
  if (column.key === "task_id") {
    return <code style={{ color: "var(--muted)" }}>{shortId(task.id)}</code>;
  }

  const isName = column.key === "name";
  const current = isName ? task.title : value == null ? "" : String(value);

  const save = (next: string) => {
    if (next === current) return;
    startTransition(async () => {
      if (isName) await renameTask(boardId, task.id, next);
      else await setCellValue(boardId, task.id, column.id, column.key, next);
    });
  };

  const dim = pending ? 0.5 : 1;

  // Person (PM / Macher): pick a user.
  if (column.type === "person") {
    return (
      <select
        value={current}
        disabled={pending}
        onChange={(e) => save(e.target.value)}
        style={{
          opacity: dim,
          background: "#0f1115",
          color: current ? "var(--text)" : "var(--muted)",
          border: "1px solid #2a2f3a",
          borderRadius: 6,
          padding: "4px 8px",
          fontSize: 13,
          cursor: "pointer",
          maxWidth: 160,
        }}
      >
        <option value="">—</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    );
  }

  // Status: always a dropdown (click → choose).
  if (column.type === "status") {
    const options: StatusOption[] = column.options.options ?? [];
    const color =
      options.find((o) => o.label === current)?.color ?? "transparent";
    return (
      <select
        value={current}
        disabled={pending}
        onChange={(e) => save(e.target.value)}
        style={{
          opacity: dim,
          background: current ? color : "#0f1115",
          color: current ? "#0d0f13" : "var(--muted)",
          border: "none",
          borderRadius: 6,
          padding: "3px 8px",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          maxWidth: 160,
        }}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.label} value={o.label}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  // Everything else: click to edit an input of the right type.
  if (editing) {
    const inputType =
      column.type === "date"
        ? "date"
        : column.type === "link"
          ? "url"
          : column.type === "number"
            ? "number"
            : "text";
    return (
      <input
        autoFocus
        type={inputType}
        defaultValue={current}
        onBlur={(e) => {
          setEditing(false);
          save(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        style={{
          width: "100%",
          minWidth: 90,
          background: "#0f1115",
          border: "1px solid var(--accent)",
          borderRadius: 6,
          padding: "4px 8px",
          color: "var(--text)",
          fontSize: 14,
        }}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      style={{
        display: "inline-block",
        minWidth: 60,
        minHeight: 20,
        cursor: "text",
        opacity: dim,
        color: current ? "var(--text)" : "#5b6472",
      }}
      title="Zum Bearbeiten klicken"
    >
      {column.type === "link" && current ? "🔗 " : ""}
      {current || "—"}
    </span>
  );
}
