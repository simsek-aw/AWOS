"use client";

import { useMemo, useState } from "react";
import { createTask } from "@/app/(app)/boards/[id]/actions";
import EditableCell from "./EditableCell";
import TaskDrawer from "./TaskDrawer";
import type { Column, Task, TaskValue } from "@/lib/types";

export default function BoardTable({
  boardId,
  boardName,
  columns,
  tasks,
  values,
  currentUserId,
}: {
  boardId: string;
  boardName: string;
  columns: Column[];
  tasks: Task[];
  values: TaskValue[];
  currentUserId: string;
}) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  // valueMap[taskId][columnId] = value
  const valueMap = useMemo(() => {
    const m = new Map<string, Map<string, unknown>>();
    for (const v of values) {
      if (!m.has(v.task_id)) m.set(v.task_id, new Map());
      m.get(v.task_id)!.set(v.column_id, v.value);
    }
    return m;
  }, [values]);

  const openTask = tasks.find((t) => t.id === openTaskId) ?? null;
  const createTaskBound = createTask.bind(null, boardId);

  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 40 }} />
              {columns.map((c) => (
                <th key={c.id} style={th}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} style={{ background: openTaskId === t.id ? "#141a22" : undefined }}>
                <td style={{ ...td, textAlign: "center" }}>
                  <button
                    onClick={() => setOpenTaskId(t.id)}
                    title="Öffnen / Kommentare"
                    style={openBtn}
                  >
                    💬
                  </button>
                </td>
                {columns.map((c) => (
                  <td key={c.id} style={td}>
                    <EditableCell
                      boardId={boardId}
                      task={t}
                      column={c}
                      value={valueMap.get(t.id)?.get(c.id) ?? null}
                    />
                  </td>
                ))}
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} style={{ ...td, color: "#5b6472" }}>
                  Noch keine Tasks.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form action={createTaskBound} style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <input
          type="text"
          name="title"
          placeholder="+ Neuer Task…"
          required
          style={{
            flex: 1,
            maxWidth: 360,
            background: "#0f1115",
            border: "1px solid #2a2f3a",
            borderRadius: 8,
            padding: "10px 12px",
            color: "var(--text)",
          }}
        />
        <button type="submit" style={addBtn}>
          Hinzufügen
        </button>
      </form>

      {openTask && (
        <TaskDrawer
          boardId={boardId}
          boardName={boardName}
          columns={columns}
          task={openTask}
          values={values.filter((v) => v.task_id === openTask.id)}
          currentUserId={currentUserId}
          onClose={() => setOpenTaskId(null)}
        />
      )}
    </>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "var(--muted)",
  borderBottom: "1px solid #222834",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid #1a1f28",
  fontSize: 14,
};

const openBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: 15,
  opacity: 0.8,
};

const addBtn: React.CSSProperties = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "0 16px",
  fontWeight: 600,
  cursor: "pointer",
};
