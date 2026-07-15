"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createGroup, moveTask } from "@/app/(app)/boards/[id]/actions";
import type {
  Column,
  Group,
  Person,
  Task,
  TaskValue,
} from "@/lib/types";
import BoardTable from "./BoardTable";

type DeadlineFilter = "all" | "overdue" | "today" | "week" | "none";

function toIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value) return [String(value)];
  return [];
}

function todayStr(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export default function BoardView({
  boardId,
  boardName,
  columns,
  groups,
  tasks,
  values,
  people,
  commentCounts,
  currentUserId,
  isEmployee,
  showCustomer = false,
  customerByTask = {},
}: {
  boardId: string;
  boardName: string;
  columns: Column[];
  groups: Group[];
  tasks: Task[];
  values: TaskValue[];
  people: Person[];
  commentCounts: Record<string, number>;
  currentUserId: string;
  isEmployee: boolean;
  showCustomer?: boolean;
  customerByTask?: Record<string, string>;
}) {
  // Local, optimistic copy of tasks so drag & drop moves feel instant. Resynced
  // whenever fresh server data arrives (the prop reference changes on refetch).
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const [, startTransition] = useTransition();

  // --- Filters -------------------------------------------------------------
  const [pmFilter, setPmFilter] = useState("");
  const [macherFilter, setMacherFilter] = useState("");
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>("all");

  const pmCol = columns.find((c) => c.key === "pm");
  const macherCol = columns.find((c) => c.key === "macher");
  const deadlineCol = columns.find((c) => c.key === "deadline");

  // task_id -> (column_id -> value)
  const valueMap = useMemo(() => {
    const m = new Map<string, Map<string, unknown>>();
    for (const v of values) {
      if (!m.has(v.task_id)) m.set(v.task_id, new Map());
      m.get(v.task_id)!.set(v.column_id, v.value);
    }
    return m;
  }, [values]);

  const filtersActive =
    !!pmFilter || !!macherFilter || deadlineFilter !== "all";

  const { todayS, weekEndS } = useMemo(() => {
    const now = new Date();
    const end = new Date(now);
    end.setDate(now.getDate() + 7);
    return { todayS: todayStr(now), weekEndS: todayStr(end) };
  }, []);

  const passesFilter = (t: Task): boolean => {
    const vals = valueMap.get(t.id);
    if (pmFilter && pmCol) {
      if (!toIds(vals?.get(pmCol.id)).includes(pmFilter)) return false;
    }
    if (macherFilter && macherCol) {
      if (!toIds(vals?.get(macherCol.id)).includes(macherFilter)) return false;
    }
    if (deadlineFilter !== "all" && deadlineCol) {
      const raw = vals?.get(deadlineCol.id);
      const dl = raw ? String(raw).slice(0, 10) : "";
      if (deadlineFilter === "none") {
        if (dl) return false;
      } else if (!dl) {
        return false;
      } else if (deadlineFilter === "overdue") {
        if (!(dl < todayS)) return false;
      } else if (deadlineFilter === "today") {
        if (dl !== todayS) return false;
      } else if (deadlineFilter === "week") {
        if (!(dl >= todayS && dl <= weekEndS)) return false;
      }
    }
    return true;
  };

  const firstGroupId = groups[0]?.id ?? null;
  const tasksByGroup = useMemo(() => {
    const filtered = localTasks.filter(passesFilter);
    const byGroup = new Map<string, Task[]>();
    for (const g of groups) byGroup.set(g.id, []);
    for (const t of filtered) {
      const key =
        t.group_id && byGroup.has(t.group_id) ? t.group_id : firstGroupId;
      if (key) byGroup.get(key)!.push(t);
    }
    return byGroup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localTasks, groups, pmFilter, macherFilter, deadlineFilter, valueMap]);

  // --- Drag & drop between groups -----------------------------------------
  const draggingRef = useRef<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const onTaskDragStart = (taskId: string) => {
    draggingRef.current = taskId;
    setDragActive(true);
  };

  // Optimistically move a task into another group, then persist.
  const applyMove = (taskId: string, groupId: string) => {
    const t = localTasks.find((x) => x.id === taskId);
    if (!t || t.group_id === groupId) return;
    setLocalTasks((prev) =>
      prev.map((x) => (x.id === taskId ? { ...x, group_id: groupId } : x)),
    );
    startTransition(() => moveTask(boardId, taskId, groupId));
  };

  const onGroupDrop = (groupId: string) => {
    const taskId = draggingRef.current;
    draggingRef.current = null;
    setDragActive(false);
    if (taskId) applyMove(taskId, groupId);
  };

  const createGroupBound = createGroup.bind(null, boardId);

  return (
    <div
      onDragEnd={() => {
        draggingRef.current = null;
        setDragActive(false);
      }}
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>
          Filter:
        </span>
        {pmCol && (
          <FilterSelect
            label={pmCol.label}
            value={pmFilter}
            onChange={setPmFilter}
            options={[
              { value: "", label: `Alle (${pmCol.label})` },
              ...people.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        )}
        {macherCol && (
          <FilterSelect
            label={macherCol.label}
            value={macherFilter}
            onChange={setMacherFilter}
            options={[
              { value: "", label: `Alle (${macherCol.label})` },
              ...people.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        )}
        {deadlineCol && (
          <FilterSelect
            label={deadlineCol.label}
            value={deadlineFilter}
            onChange={(v) => setDeadlineFilter(v as DeadlineFilter)}
            options={[
              { value: "all", label: `Alle (${deadlineCol.label})` },
              { value: "overdue", label: "Überfällig" },
              { value: "today", label: "Heute" },
              { value: "week", label: "Nächste 7 Tage" },
              { value: "none", label: "Ohne Datum" },
            ]}
          />
        )}
        {filtersActive && (
          <button
            onClick={() => {
              setPmFilter("");
              setMacherFilter("");
              setDeadlineFilter("all");
            }}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "6px 12px",
              color: "var(--muted)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      {groups.map((g) => (
        <BoardTable
          key={g.id}
          boardId={boardId}
          boardName={boardName}
          group={g}
          columns={columns}
          tasks={tasksByGroup.get(g.id) ?? []}
          values={values}
          people={people}
          commentCounts={commentCounts}
          currentUserId={currentUserId}
          isEmployee={isEmployee}
          groups={groups}
          showCustomer={showCustomer}
          customerByTask={customerByTask}
          onTaskDragStart={onTaskDragStart}
          onGroupDrop={onGroupDrop}
          onMoveToGroup={applyMove}
          dragActive={dragActive}
        />
      ))}

      <form action={createGroupBound}>
        <button
          type="submit"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "10px 16px",
            color: "var(--text)",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          Neue Gruppe hinzufügen
        </button>
      </form>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const active = value !== "" && value !== "all";
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: "var(--input-bg)",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 8,
        padding: "6px 10px",
        color: active ? "var(--text)" : "var(--muted)",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        maxWidth: 200,
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
