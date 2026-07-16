"use client";

import { useMemo, useState } from "react";
import Icon from "@/components/icons";
import type { Column, Task, TaskValue } from "@/lib/types";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

// Month calendar: tasks placed on their deadline day. Click opens the drawer.
export default function BoardCalendar({
  columns,
  tasks,
  values,
  onOpenTask,
}: {
  columns: Column[];
  tasks: Task[];
  values: TaskValue[];
  onOpenTask: (id: string) => void;
}) {
  const statusCol = columns.find((c) => c.type === "status");
  const deadlineCol = columns.find((c) => c.key === "deadline");

  const valueMap = useMemo(() => {
    const m = new Map<string, Map<string, unknown>>();
    for (const v of values) {
      if (!m.has(v.task_id)) m.set(v.task_id, new Map());
      m.get(v.task_id)!.set(v.column_id, v.value);
    }
    return m;
  }, [values]);

  const now = new Date();
  const [cursor, setCursor] = useState({
    y: now.getFullYear(),
    m: now.getMonth(),
  });
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Tasks by deadline day (YYYY-MM-DD).
  const byDay = useMemo(() => {
    const m = new Map<string, { task: Task; status: string }[]>();
    if (!deadlineCol) return m;
    for (const t of tasks) {
      const dl = String(valueMap.get(t.id)?.get(deadlineCol.id) ?? "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dl)) continue;
      const status = String(valueMap.get(t.id)?.get(statusCol?.id ?? "") ?? "");
      if (!m.has(dl)) m.set(dl, []);
      m.get(dl)!.push({ task: t, status });
    }
    return m;
  }, [tasks, valueMap, deadlineCol, statusCol]);

  const statusColor = (label: string) =>
    statusCol?.options.options?.find((o) => o.label === label)?.color ?? "#6b7189";

  const first = new Date(cursor.y, cursor.m, 1);
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday-first offset
  const cells: (number | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const shift = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };
  const dayStr = (d: number) =>
    `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <button onClick={() => shift(-1)} style={navBtn} title="Vorheriger Monat">
          <Icon name="chevron-left" size={16} />
        </button>
        <strong style={{ fontSize: 16, minWidth: 160, textAlign: "center" }}>
          {MONTHS[cursor.m]} {cursor.y}
        </strong>
        <button onClick={() => shift(1)} style={navBtn} title="Nächster Monat">
          <Icon name="chevron-right" size={16} />
        </button>
        <button
          onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })}
          style={{ ...navBtn, width: "auto", padding: "0 12px", fontSize: 13 }}
        >
          Heute
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 1,
          background: "var(--border)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            style={{
              background: "var(--surface-2)",
              padding: "6px 8px",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--muted)",
              textTransform: "uppercase",
            }}
          >
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          const ds = d ? dayStr(d) : "";
          const items = ds ? byDay.get(ds) ?? [] : [];
          const isToday = ds === todayStr;
          return (
            <div
              key={i}
              style={{
                background: "var(--surface)",
                minHeight: 96,
                padding: 6,
                opacity: d ? 1 : 0.5,
              }}
            >
              {d && (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: isToday ? 700 : 500,
                    color: isToday ? "var(--accent)" : "var(--muted)",
                    marginBottom: 4,
                  }}
                >
                  {d}
                </div>
              )}
              <div style={{ display: "grid", gap: 3 }}>
                {items.slice(0, 4).map(({ task, status }) => (
                  <button
                    key={task.id}
                    onClick={() => onOpenTask(task.id)}
                    title={task.title}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      padding: "3px 6px",
                      cursor: "pointer",
                      textAlign: "left",
                      width: "100%",
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: statusColor(status),
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: "var(--text)",
                      }}
                    >
                      {task.title}
                    </span>
                  </button>
                ))}
                {items.length > 4 && (
                  <span style={{ fontSize: 11, color: "var(--faint)" }}>
                    +{items.length - 4} mehr
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 34,
  height: 34,
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text)",
  cursor: "pointer",
};
