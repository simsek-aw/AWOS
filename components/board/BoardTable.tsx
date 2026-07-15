"use client";

import { useMemo, useState } from "react";
import { createTask } from "@/app/(app)/boards/[id]/actions";
import type { Column, Person, StatusOption, Task, TaskValue } from "@/lib/types";
import { AvatarStack } from "./Avatar";
import EditableCell from "./EditableCell";
import TaskDrawer from "./TaskDrawer";

function accentFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 70% 55%)`;
}

export default function BoardTable({
  boardId,
  boardName,
  columns,
  tasks,
  values,
  people,
  commentCounts,
  currentUserId,
}: {
  boardId: string;
  boardName: string;
  columns: Column[];
  tasks: Task[];
  values: TaskValue[];
  people: Person[];
  commentCounts: Record<string, number>;
  currentUserId: string;
}) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const valueMap = useMemo(() => {
    const m = new Map<string, Map<string, unknown>>();
    for (const v of values) {
      if (!m.has(v.task_id)) m.set(v.task_id, new Map());
      m.get(v.task_id)!.set(v.column_id, v.value);
    }
    return m;
  }, [values]);

  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.id, p.name])),
    [people],
  );

  const openTask = tasks.find((t) => t.id === openTaskId) ?? null;
  const createTaskBound = createTask.bind(null, boardId);
  const accent = accentFor(boardName);

  const allSelected = tasks.length > 0 && selected.size === tasks.length;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(tasks.map((t) => t.id)));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const valueOf = (taskId: string, columnId: string) =>
    valueMap.get(taskId)?.get(columnId) ?? null;

  return (
    <div
      style={{
        borderLeft: `4px solid ${accent}`,
        borderRadius: 6,
        overflow: "hidden",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeftWidth: 4,
      }}
    >
      {/* Group header */}
      <div
        onClick={() => setCollapsed((c) => !c)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 14px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span style={{ color: accent, fontSize: 13 }}>
          {collapsed ? "▸" : "▾"}
        </span>
        <span style={{ color: accent, fontWeight: 700, fontSize: 18 }}>
          {boardName}
        </span>
        <span style={{ color: "var(--muted)", fontSize: 13, marginLeft: 6 }}>
          {tasks.length}
        </span>
      </div>

      {!collapsed && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 40, textAlign: "center" }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                {columns.map((c) => (
                  <th
                    key={c.id}
                    style={{
                      ...th,
                      textAlign:
                        c.type === "status" || c.type === "person"
                          ? "center"
                          : "left",
                    }}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {tasks.map((t) => {
                const isSel = selected.has(t.id);
                const isOpen = openTaskId === t.id;
                return (
                  <tr
                    key={t.id}
                    style={{
                      background: isOpen
                        ? "var(--active)"
                        : isSel
                          ? "var(--surface-2)"
                          : undefined,
                    }}
                  >
                    <td style={{ ...td, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggleOne(t.id)}
                      />
                    </td>
                    {columns.map((c) => {
                      const isStatus = c.type === "status";
                      const isPerson = c.type === "person";
                      return (
                        <td
                          key={c.id}
                          style={{
                            ...td,
                            padding: isStatus ? 0 : td.padding,
                            textAlign: isPerson ? "center" : "left",
                          }}
                        >
                          {c.key === "name" ? (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 8,
                              }}
                            >
                              <EditableCell
                                boardId={boardId}
                                task={t}
                                column={c}
                                value={t.title}
                                people={people}
                              />
                              <button
                                onClick={() => setOpenTaskId(t.id)}
                                title="Öffnen / Kommentare"
                                style={commentBtn}
                              >
                                💬
                                {commentCounts[t.id] ? (
                                  <span style={countBadge}>{commentCounts[t.id]}</span>
                                ) : null}
                              </button>
                            </div>
                          ) : (
                            <EditableCell
                              boardId={boardId}
                              task={t}
                              column={c}
                              value={valueOf(t.id, c.id)}
                              people={people}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {tasks.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} style={{ ...td, color: "var(--faint)" }}>
                    Noch keine Tasks.
                  </td>
                </tr>
              )}

              {/* Add row */}
              <tr>
                <td />
                <td colSpan={columns.length} style={{ ...td, borderRight: "none" }}>
                  <form action={createTaskBound} style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      name="title"
                      placeholder="+ Element hinzufügen…"
                      required
                      style={{
                        flex: 1,
                        maxWidth: 360,
                        background: "transparent",
                        border: "none",
                        color: "var(--text)",
                        fontSize: 14,
                        outline: "none",
                      }}
                    />
                    <button type="submit" style={addBtn}>
                      Hinzufügen
                    </button>
                  </form>
                </td>
              </tr>
            </tbody>

            {tasks.length > 0 && (
              <tfoot>
                <tr>
                  <td style={footTd} />
                  {columns.map((c) => (
                    <td key={c.id} style={{ ...footTd, textAlign: "center" }}>
                      <FooterCell
                        column={c}
                        tasks={tasks}
                        valueOf={valueOf}
                        peopleById={peopleById}
                      />
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {openTask && (
        <TaskDrawer
          boardId={boardId}
          boardName={boardName}
          columns={columns}
          task={openTask}
          values={values.filter((v) => v.task_id === openTask.id)}
          people={people}
          currentUserId={currentUserId}
          onClose={() => setOpenTaskId(null)}
        />
      )}
    </div>
  );
}

function FooterCell({
  column,
  tasks,
  valueOf,
  peopleById,
}: {
  column: Column;
  tasks: Task[];
  valueOf: (taskId: string, columnId: string) => unknown;
  peopleById: Map<string, string>;
}) {
  if (column.type === "status") {
    const options: StatusOption[] = column.options.options ?? [];
    const counts = new Map<string, number>();
    let total = 0;
    for (const t of tasks) {
      const v = valueOf(t.id, column.id);
      if (v) {
        counts.set(String(v), (counts.get(String(v)) ?? 0) + 1);
        total++;
      }
    }
    if (total === 0) return null;
    return (
      <div
        style={{
          display: "flex",
          height: 18,
          borderRadius: 4,
          overflow: "hidden",
          margin: "0 8px",
        }}
      >
        {[...counts.entries()].map(([label, count]) => {
          const color =
            options.find((o) => o.label === label)?.color ?? "#c4c4c4";
          return (
            <span
              key={label}
              title={`${label}: ${count}`}
              style={{ width: `${(count / total) * 100}%`, background: color }}
            />
          );
        })}
      </div>
    );
  }

  if (column.type === "person") {
    const names: string[] = [];
    const seen = new Set<string>();
    for (const t of tasks) {
      const v = valueOf(t.id, column.id);
      if (v && !seen.has(String(v))) {
        seen.add(String(v));
        const name = peopleById.get(String(v));
        if (name) names.push(name);
      }
    }
    if (names.length === 0) return null;
    return <AvatarStack names={names} size={24} />;
  }

  return null;
}

const th: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "var(--muted)",
  borderBottom: "1px solid var(--border)",
  borderRight: "1px solid var(--border)",
  whiteSpace: "nowrap",
  fontWeight: 600,
};

const td: React.CSSProperties = {
  padding: "6px 12px",
  borderBottom: "1px solid var(--border)",
  borderRight: "1px solid var(--border)",
  fontSize: 14,
  verticalAlign: "middle",
  height: 44,
};

const footTd: React.CSSProperties = {
  padding: "8px 12px",
  borderRight: "1px solid var(--border)",
  height: 40,
};

const commentBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: 14,
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  color: "var(--muted)",
  flexShrink: 0,
};

const countBadge: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--muted)",
};

const addBtn: React.CSSProperties = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "6px 16px",
  fontWeight: 600,
  cursor: "pointer",
};
