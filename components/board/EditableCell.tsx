"use client";

import { useState, useTransition } from "react";
import {
  renameTask,
  setCellValue,
} from "@/app/(app)/boards/[id]/actions";
import { shortId } from "@/components/columns";
import type { Column, Person, StatusOption, Task } from "@/lib/types";
import { Avatar, EmptyAvatar } from "./Avatar";

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

  // Person (PM / Macher): avatar bubble; click to pick.
  if (column.type === "person") {
    if (editing) {
      return (
        <select
          autoFocus
          value={current}
          disabled={pending}
          onChange={(e) => {
            save(e.target.value);
            setEditing(false);
          }}
          onBlur={() => setEditing(false)}
          style={{
            background: "var(--input-bg)",
            color: "var(--text)",
            border: "1px solid var(--accent)",
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 13,
            cursor: "pointer",
            maxWidth: 170,
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
    const person = people.find((p) => p.id === current);
    return (
      <span
        onClick={() => setEditing(true)}
        title={person ? person.name : "Zuweisen"}
        style={{
          display: "inline-flex",
          cursor: "pointer",
          opacity: dim,
        }}
      >
        {person ? <Avatar name={person.name} /> : <EmptyAvatar />}
      </span>
    );
  }

  // Status: full-cell colored dropdown (monday-style).
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
          appearance: "none",
          WebkitAppearance: "none",
          display: "block",
          width: "100%",
          height: 40,
          textAlign: "center",
          textAlignLast: "center",
          background: current ? color : "transparent",
          color: current ? "#fff" : "var(--muted)",
          border: "none",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
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
          background: "var(--input-bg)",
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
        color: current ? "var(--text)" : "var(--faint)",
      }}
      title="Zum Bearbeiten klicken"
    >
      {column.type === "link" && current ? "🔗 " : ""}
      {current || "—"}
    </span>
  );
}
