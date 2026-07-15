"use client";

import type { Column, Person, Task, TaskValue } from "@/lib/types";
import EditableCell from "./EditableCell";

// Compact task fields: PM · Macher · Deadline · Status in a 2×2 grid, then
// the remaining fields (Output, custom columns) stacked below.
const GRID_KEYS = ["pm", "macher", "deadline", "status"];
const HIDDEN_KEYS = new Set(["task_id", "name"]);

export default function TaskFields({
  boardId,
  task,
  columns,
  values,
  people,
  isEmployee,
}: {
  boardId: string;
  task: Task;
  columns: Column[];
  values: TaskValue[];
  people: Person[];
  isEmployee: boolean;
}) {
  const valueOf = (columnId: string) =>
    values.find((v) => v.column_id === columnId)?.value ?? null;

  const gridCols = GRID_KEYS.map((k) => columns.find((c) => c.key === k)).filter(
    (c): c is Column => !!c,
  );
  const restCols = columns.filter(
    (c) => !HIDDEN_KEYS.has(c.key) && !GRID_KEYS.includes(c.key),
  );

  const Field = ({ c }: { c: Column }) => (
    <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
      <label style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.3 }}>
        {c.label}
      </label>
      <EditableCell
        boardId={boardId}
        task={task}
        column={c}
        value={valueOf(c.id)}
        people={people}
        canEditLabels={isEmployee}
      />
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {gridCols.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 14,
          }}
        >
          {gridCols.map((c) => (
            <Field key={c.id} c={c} />
          ))}
        </div>
      )}
      {restCols.map((c) => (
        <Field key={c.id} c={c} />
      ))}
    </div>
  );
}
