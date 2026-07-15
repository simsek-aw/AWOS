"use client";

import { shortId } from "@/components/columns";
import type { Column, Person, Task, TaskValue } from "@/lib/types";
import EditableCell from "./EditableCell";
import TaskUpdates from "./TaskUpdates";

const ROW_BOUND = new Set(["task_id"]);

export default function TaskDrawer({
  boardId,
  boardName,
  columns,
  task,
  values,
  people,
  currentUserId,
  isEmployee,
  highlightCommentId = null,
  onClose,
}: {
  boardId: string;
  boardName: string;
  columns: Column[];
  task: Task;
  values: TaskValue[];
  people: Person[];
  currentUserId: string;
  isEmployee: boolean;
  highlightCommentId?: string | null;
  onClose: () => void;
}) {
  const valueOf = (columnId: string) =>
    values.find((v) => v.column_id === columnId)?.value ?? null;

  const nameColumn = columns.find((c) => c.key === "name");
  const fields = columns.filter((c) => !ROW_BOUND.has(c.key) && c.key !== "name");

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 40,
        }}
      />
      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(480px, 100%)",
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          zIndex: 41,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ color: "var(--muted)", fontSize: 12 }}>
            {boardName} · <code>{shortId(task.id)}</code>
          </div>
          <button onClick={onClose} style={closeBtn} title="Schließen">
            ✕
          </button>
        </div>

        <div style={{ padding: 18, overflowY: "auto" }}>
          {/* Title */}
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
            {nameColumn ? (
              <EditableCell
                boardId={boardId}
                task={task}
                column={nameColumn}
                value={task.title}
                people={people}
              />
            ) : (
              task.title
            )}
          </div>

          {/* Fields */}
          <div style={{ display: "grid", gap: 12 }}>
            {fields.map((c) => (
              <div key={c.id} style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 12, color: "var(--muted)" }}>{c.label}</label>
                <EditableCell
                  boardId={boardId}
                  task={task}
                  column={c}
                  value={valueOf(c.id)}
                  people={people}
                  canEditLabels={isEmployee}
                />
              </div>
            ))}
          </div>

          <a
            href={`/boards/${boardId}/tasks/${task.id}`}
            style={{ display: "inline-block", marginTop: 16, fontSize: 13 }}
          >
            Vollansicht öffnen (Dateien) →
          </a>

          <TaskUpdates
            boardId={boardId}
            taskId={task.id}
            people={people}
            currentUserId={currentUserId}
            isEmployee={isEmployee}
            highlightCommentId={highlightCommentId}
          />
        </div>
      </div>
    </>
  );
}

const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--muted)",
  fontSize: 16,
  cursor: "pointer",
};
