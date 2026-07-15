"use client";

import { useState, useTransition } from "react";
import { renameTask, setCellValue } from "@/app/(app)/boards/[id]/actions";
import { shortId } from "@/components/columns";
import type { Column, Person, Task } from "@/lib/types";
import PersonCell from "./PersonCell";
import StatusCell from "./StatusCell";

export default function EditableCell({
  boardId,
  task,
  column,
  value,
  people = [],
  canEditLabels = false,
}: {
  boardId: string;
  task: Task;
  column: Column;
  value: unknown;
  people?: Person[];
  canEditLabels?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  // Task-ID: read-only.
  if (column.key === "task_id") {
    return <code style={{ color: "var(--muted)" }}>{shortId(task.id)}</code>;
  }

  // Person (PM / Macher): multi-select with search.
  if (column.type === "person") {
    return (
      <PersonCell
        boardId={boardId}
        taskId={task.id}
        columnId={column.id}
        columnKey={column.key}
        value={value}
        people={people}
      />
    );
  }

  // Status: colored grid picker (+ label editor for employees).
  if (column.type === "status") {
    return (
      <StatusCell
        boardId={boardId}
        taskId={task.id}
        column={column}
        value={value}
        canEditLabels={canEditLabels}
      />
    );
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

  // Text / date / number / link: click to edit.
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
