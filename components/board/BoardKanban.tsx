"use client";

import { useEffect, useMemo, useState } from "react";
import {
  moveTask,
  setCellValue,
  setPeople,
} from "@/app/(app)/boards/[id]/actions";
import Icon from "@/components/icons";
import { deadlineUrgency, formatDate } from "@/lib/format";
import type { Column, Group, Person, Task, TaskValue } from "@/lib/types";
import { AvatarStack } from "./Avatar";
import { statusPillStyle, urgencyPillStyle } from "./pills";

type GroupBy = "status" | "pm" | "macher" | "group";
type Col = { key: string; label: string; color?: string };

export default function BoardKanban({
  boardId,
  columns,
  tasks,
  values,
  people,
  groups,
  commentCounts,
  unreadTasks = [],
  groupBy,
  onOpenTask,
}: {
  boardId: string;
  columns: Column[];
  tasks: Task[];
  values: TaskValue[];
  people: Person[];
  groups: Group[];
  commentCounts: Record<string, number>;
  unreadTasks?: string[];
  groupBy: GroupBy;
  onOpenTask: (id: string) => void;
}) {
  const statusCol = columns.find((c) => c.type === "status");
  const pmCol = columns.find((c) => c.key === "pm");
  const macherCol = columns.find((c) => c.key === "macher");
  const deadlineCol = columns.find((c) => c.key === "deadline");
  const peopleName = useMemo(
    () => new Map(people.map((p) => [p.id, p.name])),
    [people],
  );
  const unread = useMemo(() => new Set(unreadTasks), [unreadTasks]);

  const valueMap = useMemo(() => {
    const m = new Map<string, Map<string, unknown>>();
    for (const v of values) {
      if (!m.has(v.task_id)) m.set(v.task_id, new Map());
      m.get(v.task_id)!.set(v.column_id, v.value);
    }
    return m;
  }, [values]);

  const val = (taskId: string, colId?: string) =>
    colId ? valueMap.get(taskId)?.get(colId) ?? null : null;
  const firstId = (v: unknown): string =>
    Array.isArray(v) ? (v[0] ? String(v[0]) : "") : v ? String(v) : "";

  // Optimistic overrides for the current dimension: taskId -> columnKey.
  const [moved, setMoved] = useState<Record<string, string>>({});
  useEffect(() => setMoved({}), [groupBy, tasks]);

  const columnsForView = (): Col[] => {
    if (groupBy === "status") {
      const opts = statusCol?.options.options ?? [];
      return [
        ...opts.map((o) => ({ key: o.label, label: o.label, color: o.color })),
        { key: "", label: "Ohne Status" },
      ];
    }
    if (groupBy === "pm" || groupBy === "macher") {
      return [
        ...people.map((p) => ({ key: p.id, label: p.name })),
        { key: "", label: "Nicht zugewiesen" },
      ];
    }
    return groups.map((g) => ({ key: g.id, label: g.name }));
  };
  const cols = columnsForView();
  const colKeys = new Set(cols.map((c) => c.key));

  const keyOfTask = (t: Task): string => {
    if (moved[t.id] !== undefined) return moved[t.id];
    let k = "";
    if (groupBy === "status") k = String(val(t.id, statusCol?.id) ?? "");
    else if (groupBy === "pm") k = firstId(val(t.id, pmCol?.id));
    else if (groupBy === "macher") k = firstId(val(t.id, macherCol?.id));
    else k = t.group_id ?? "";
    return colKeys.has(k) ? k : "";
  };

  const byCol = new Map<string, Task[]>();
  for (const c of cols) byCol.set(c.key, []);
  for (const t of tasks) {
    const k = keyOfTask(t);
    (byCol.get(k) ?? byCol.get("")!)?.push(t);
  }

  const drop = (t: Task, colKey: string) => {
    setMoved((m) => ({ ...m, [t.id]: colKey }));
    if (groupBy === "status" && statusCol)
      setCellValue(boardId, t.id, statusCol.id, "status", colKey);
    else if (groupBy === "pm" && pmCol)
      setPeople(boardId, t.id, pmCol.id, "pm", colKey ? [colKey] : []);
    else if (groupBy === "macher" && macherCol)
      setPeople(boardId, t.id, macherCol.id, "macher", colKey ? [colKey] : []);
    else if (groupBy === "group" && colKey) moveTask(boardId, t.id, colKey);
  };

  const [overCol, setOverCol] = useState<string | null>(null);

  return (
    <div style={{ overflowX: "auto", paddingBottom: 8 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", minHeight: 200 }}>
        {cols.map((c) => {
          const list = byCol.get(c.key) ?? [];
          return (
            <div
              key={c.key || "none"}
              onDragOver={(e) => {
                e.preventDefault();
                if (overCol !== c.key) setOverCol(c.key);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setOverCol((o) => (o === c.key ? null : o));
              }}
              onDrop={(e) => {
                e.preventDefault();
                setOverCol(null);
                const id = e.dataTransfer.getData("text/plain");
                const t = tasks.find((x) => x.id === id);
                if (t) drop(t, c.key);
              }}
              style={{
                width: 260,
                flexShrink: 0,
                background:
                  overCol === c.key ? "var(--active)" : "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 8,
                transition: "background 120ms",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 6px 10px",
                }}
              >
                {c.color && (
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      background: c.color,
                    }}
                  />
                )}
                <span style={{ fontWeight: 700, fontSize: 13 }}>{c.label}</span>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>
                  {list.length}
                </span>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {list.map((t) => {
                  const status = String(val(t.id, statusCol?.id) ?? "");
                  const statusColor =
                    statusCol?.options.options?.find((o) => o.label === status)
                      ?.color ?? "#6b7189";
                  const deadline = String(val(t.id, deadlineCol?.id) ?? "").slice(
                    0,
                    10,
                  );
                  const urgency =
                    deadline && status !== "Fertig"
                      ? deadlineUrgency(deadline)
                      : null;
                  const pmNames = (
                    Array.isArray(val(t.id, pmCol?.id))
                      ? (val(t.id, pmCol?.id) as unknown[])
                      : []
                  )
                    .map((id) => peopleName.get(String(id)) ?? "?")
                    .filter(Boolean);
                  const macherNames = (
                    Array.isArray(val(t.id, macherCol?.id))
                      ? (val(t.id, macherCol?.id) as unknown[])
                      : []
                  )
                    .map((id) => peopleName.get(String(id)) ?? "?")
                    .filter(Boolean);
                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData("text/plain", t.id)
                      }
                      onClick={() => onOpenTask(t.id)}
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        padding: 10,
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 6,
                          alignItems: "flex-start",
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: 14 }}>
                          {t.title}
                        </span>
                        {commentCounts[t.id] ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              flexShrink: 0,
                              color: unread.has(t.id)
                                ? "var(--accent)"
                                : "var(--muted)",
                              fontSize: 12,
                            }}
                          >
                            <Icon name="message" size={14} />
                            {commentCounts[t.id]}
                          </span>
                        ) : null}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: 6,
                          marginTop: 8,
                        }}
                      >
                        {groupBy !== "status" && status && (
                          <span style={statusPillStyle(statusColor)}>{status}</span>
                        )}
                        {pmNames.length > 0 && (
                          <AvatarStack names={pmNames} size={20} />
                        )}
                        {macherNames.length > 0 && (
                          <AvatarStack names={macherNames} size={20} />
                        )}
                        {deadline && (
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>
                            {formatDate(deadline)}
                          </span>
                        )}
                        {urgency && (
                          <span style={urgencyPillStyle(urgency.tone)}>
                            {urgency.label}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {list.length === 0 && (
                  <div
                    style={{
                      color: "var(--faint)",
                      fontSize: 12,
                      textAlign: "center",
                      padding: "12px 0",
                    }}
                  >
                    —
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
