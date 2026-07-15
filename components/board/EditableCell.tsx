"use client";

import { useEffect, useState, useTransition } from "react";
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
  const [, startTransition] = useTransition();
  // Optimistic override: show the new value immediately, before the server
  // round-trip + refetch lands. Reset whenever fresh server data arrives.
  const [draft, setDraft] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Task-ID: click to copy the full id.
  if (column.key === "task_id") {
    return (
      <code
        onClick={() => {
          navigator.clipboard?.writeText(task.id);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        title="Task-ID kopieren"
        style={{
          color: copied ? "var(--ok-text, #00c875)" : "var(--muted)",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        {copied ? "kopiert!" : shortId(task.id)}
      </code>
    );
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
  const serverValue = isName ? task.title : value == null ? "" : String(value);
  const current = draft ?? serverValue;

  // Dates are stored as ISO (YYYY-MM-DD) — the format <input type="date">
  // needs — but shown to the user as TT.MM.JJJJ.
  const displayValue =
    column.type === "date" ? formatDate(current) : current;

  // When the server value changes (a refetch landed), drop the optimistic
  // draft so we display the confirmed truth.
  useEffect(() => {
    setDraft(null);
  }, [serverValue]);

  const save = (next: string) => {
    if (next === current) return;
    setDraft(next); // instant UI update
    startTransition(async () => {
      if (isName) await renameTask(boardId, task.id, next);
      else await setCellValue(boardId, task.id, column.id, column.key, next);
    });
  };

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
        color: current ? "var(--text)" : "var(--faint)",
      }}
      title="Zum Bearbeiten klicken"
    >
      {column.type === "link" && current ? "🔗 " : ""}
      {displayValue || "—"}
    </span>
  );
}

/** ISO date (YYYY-MM-DD) → TT.MM.JJJJ. Passes anything else through. */
function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}
