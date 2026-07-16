"use client";

import { useMemo } from "react";
import { deadlineUrgency } from "@/lib/format";
import type { Column, Person, Task, TaskValue } from "@/lib/types";
import { Avatar } from "./Avatar";
import { urgencyPillStyle } from "./pills";

// Workload view: open tasks per person (PM or Macher) on this board, as bars.
export default function BoardWorkload({
  columns,
  tasks,
  values,
  people,
  onOpenTask,
}: {
  columns: Column[];
  tasks: Task[];
  values: TaskValue[];
  people: Person[];
  onOpenTask: (id: string) => void;
}) {
  const pmCol = columns.find((c) => c.key === "pm");
  const macherCol = columns.find((c) => c.key === "macher");
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

  const ids = (taskId: string, colId?: string): string[] => {
    const v = colId ? valueMap.get(taskId)?.get(colId) : null;
    return Array.isArray(v) ? v.map(String) : v ? [String(v)] : [];
  };

  // person id -> their (open) tasks on this board
  const perPerson = useMemo(() => {
    const map = new Map<string, { open: Task[]; total: number }>();
    const ensure = (id: string) =>
      map.get(id) ?? map.set(id, { open: [], total: 0 }).get(id)!;
    for (const t of tasks) {
      const status = String(valueMap.get(t.id)?.get(statusCol?.id ?? "") ?? "");
      const assignees = new Set([...ids(t.id, pmCol?.id), ...ids(t.id, macherCol?.id)]);
      for (const pid of assignees) {
        const e = ensure(pid);
        e.total++;
        if (status !== "Fertig") e.open.push(t);
      }
    }
    return map;
  }, [tasks, valueMap, pmCol, macherCol, statusCol]);

  const rows = people
    .map((p) => ({
      person: p,
      open: perPerson.get(p.id)?.open ?? [],
      total: perPerson.get(p.id)?.total ?? 0,
    }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.open.length - a.open.length);

  const maxOpen = Math.max(1, ...rows.map((r) => r.open.length));

  const deadlineOf = (t: Task) =>
    String(valueMap.get(t.id)?.get(deadlineCol?.id ?? "") ?? "").slice(0, 10);

  if (rows.length === 0) {
    return (
      <p style={{ color: "var(--faint)" }}>
        Keine zugewiesenen Aufgaben auf diesem Board.
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 760 }}>
      {rows.map(({ person, open, total }) => (
        <div
          key={person.id}
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--surface)",
            padding: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar name={person.name} size={28} />
            <a
              href={`/people/${person.id}`}
              style={{ fontWeight: 600, fontSize: 15, color: "var(--text)", textDecoration: "none" }}
            >
              {person.name}
            </a>
            <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--muted)" }}>
              {open.length} offen · {total} gesamt
            </span>
          </div>

          {/* Bar */}
          <div
            style={{
              height: 8,
              borderRadius: 999,
              background: "var(--surface-2)",
              marginTop: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(open.length / maxOpen) * 100}%`,
                height: "100%",
                background: "var(--accent)",
              }}
            />
          </div>

          {open.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {open.slice(0, 8).map((t) => {
                const dl = deadlineOf(t);
                const urg = dl ? deadlineUrgency(dl) : null;
                return (
                  <button
                    key={t.id}
                    onClick={() => onOpenTask(t.id)}
                    title={t.title}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 999,
                      padding: "4px 10px",
                      fontSize: 12,
                      color: "var(--text)",
                      cursor: "pointer",
                      maxWidth: 220,
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.title}
                    </span>
                    {urg && (
                      <span style={{ ...urgencyPillStyle(urg.tone), padding: "1px 6px" }}>
                        {urg.label}
                      </span>
                    )}
                  </button>
                );
              })}
              {open.length > 8 && (
                <span style={{ fontSize: 12, color: "var(--faint)", alignSelf: "center" }}>
                  +{open.length - 8} mehr
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
