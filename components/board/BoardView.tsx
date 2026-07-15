"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  createGroup,
  createTask,
  deleteBoardView,
  moveTask,
  saveBoardView,
} from "@/app/(app)/boards/[id]/actions";
import Icon, { type IconName } from "@/components/icons";
import type { Column, Group, Person, Task, TaskValue } from "@/lib/types";
import { Avatar } from "./Avatar";
import BoardTable from "./BoardTable";
import ColumnsManager from "./ColumnsManager";
import Popover from "./Popover";

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
  unreadTasks = [],
  currentUserId,
  isEmployee,
  showCustomer = false,
  customerByTask = {},
  customerIdByTask = {},
  lockedCustomerTasks = [],
  customers = [],
  savedViews = [],
  autoOpenTaskId = null,
  highlightCommentId = null,
}: {
  boardId: string;
  boardName: string;
  columns: Column[];
  groups: Group[];
  tasks: Task[];
  values: TaskValue[];
  people: Person[];
  commentCounts: Record<string, number>;
  unreadTasks?: string[];
  currentUserId: string;
  isEmployee: boolean;
  showCustomer?: boolean;
  customerByTask?: Record<string, string>;
  customerIdByTask?: Record<string, string>;
  lockedCustomerTasks?: string[];
  customers?: { id: string; name: string }[];
  savedViews?: { id: string; name: string; config: Record<string, unknown> }[];
  autoOpenTaskId?: string | null;
  highlightCommentId?: string | null;
}) {
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const [, startTransition] = useTransition();

  // --- Toolbar state -------------------------------------------------------
  const [search, setSearch] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>("all");
  // Which groups to show. Empty = show all.
  const [visibleGroupIds, setVisibleGroupIds] = useState<string[]>([]);
  const [sortColId, setSortColId] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const pmCol = columns.find((c) => c.key === "pm");
  const macherCol = columns.find((c) => c.key === "macher");
  const deadlineCol = columns.find((c) => c.key === "deadline");

  const valueMap = useMemo(() => {
    const m = new Map<string, Map<string, unknown>>();
    for (const v of values) {
      if (!m.has(v.task_id)) m.set(v.task_id, new Map());
      m.get(v.task_id)!.set(v.column_id, v.value);
    }
    return m;
  }, [values]);

  const activeFilterCount =
    (personFilter ? 1 : 0) + (deadlineFilter !== "all" ? 1 : 0);

  const groupById = useMemo(
    () => new Map(groups.map((g) => [g.id, g.name])),
    [groups],
  );
  const toggleGroupVisible = (id: string) =>
    setVisibleGroupIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );

  // Active-filter chips shown next to "Zurücksetzen"; each removable via ×.
  const deadlineLabels: Record<Exclude<DeadlineFilter, "all">, string> = {
    overdue: "Überfällig",
    today: "Heute",
    week: "Nächste 7 Tage",
    none: "Ohne Datum",
  };
  const filterChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (search)
    filterChips.push({
      key: "search",
      label: `Suche: „${search}"`,
      onRemove: () => setSearch(""),
    });
  if (personFilter)
    filterChips.push({
      key: "person",
      label: people.find((p) => p.id === personFilter)?.name ?? "Person",
      onRemove: () => setPersonFilter(""),
    });
  if (deadlineFilter !== "all")
    filterChips.push({
      key: "deadline",
      label: deadlineLabels[deadlineFilter],
      onRemove: () => setDeadlineFilter("all"),
    });
  for (const id of visibleGroupIds)
    filterChips.push({
      key: `group-${id}`,
      label: groupById.get(id) ?? "Gruppe",
      onRemove: () => toggleGroupVisible(id),
    });

  const { todayS, weekEndS } = useMemo(() => {
    const now = new Date();
    const end = new Date(now);
    end.setDate(now.getDate() + 7);
    return { todayS: todayStr(now), weekEndS: todayStr(end) };
  }, []);

  const passesFilter = (t: Task): boolean => {
    const vals = valueMap.get(t.id);
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (personFilter) {
      const inPm = pmCol && toIds(vals?.get(pmCol.id)).includes(personFilter);
      const inMa =
        macherCol && toIds(vals?.get(macherCol.id)).includes(personFilter);
      if (!inPm && !inMa) return false;
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

  const sortValue = (t: Task): string => {
    if (!sortColId) return "";
    const col = columns.find((c) => c.id === sortColId);
    if (!col) return "";
    if (col.key === "name") return t.title;
    if (col.key === "task_id") return t.id;
    const v = valueMap.get(t.id)?.get(sortColId);
    return Array.isArray(v) ? v.map(String).join(",") : v ? String(v) : "";
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
    if (sortColId) {
      const dir = sortDir === "asc" ? 1 : -1;
      for (const list of byGroup.values()) {
        list.sort(
          (a, b) =>
            sortValue(a).localeCompare(sortValue(b), "de", { numeric: true }) *
            dir,
        );
      }
    }
    return byGroup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    localTasks,
    groups,
    search,
    personFilter,
    deadlineFilter,
    sortColId,
    sortDir,
    valueMap,
  ]);

  // --- Drag & drop between groups -----------------------------------------
  const draggingRef = useRef<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const onTaskDragStart = (taskId: string) => {
    draggingRef.current = taskId;
    setDragActive(true);
  };

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

  const newTask = () => {
    if (!firstGroupId) return;
    const fd = new FormData();
    fd.set("title", "Neue Aufgabe");
    startTransition(() => createTask(boardId, firstGroupId, fd));
  };

  const resetFilters = () => {
    setSearch("");
    setPersonFilter("");
    setDeadlineFilter("all");
    setVisibleGroupIds([]);
  };

  // --- Saved views ---------------------------------------------------------
  const currentConfig = () => ({
    search,
    personFilter,
    deadlineFilter,
    visibleGroupIds,
    sortColId,
    sortDir,
  });
  const applyView = (config: Record<string, unknown>) => {
    setSearch(typeof config.search === "string" ? config.search : "");
    setPersonFilter(
      typeof config.personFilter === "string" ? config.personFilter : "",
    );
    setDeadlineFilter(
      (["all", "overdue", "today", "week", "none"].includes(
        config.deadlineFilter as string,
      )
        ? config.deadlineFilter
        : "all") as DeadlineFilter,
    );
    setVisibleGroupIds(
      Array.isArray(config.visibleGroupIds)
        ? (config.visibleGroupIds as string[])
        : [],
    );
    setSortColId(typeof config.sortColId === "string" ? config.sortColId : "");
    setSortDir(config.sortDir === "desc" ? "desc" : "asc");
  };
  const saveCurrentView = () => {
    const name = window.prompt("Name der Ansicht?");
    if (name?.trim()) {
      startTransition(() => saveBoardView(boardId, name.trim(), currentConfig()));
    }
  };

  return (
    <div
      onDragEnd={() => {
        draggingRef.current = null;
        setDragActive(false);
      }}
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
        }}
      >
        <button onClick={newTask} style={primaryBtn}>
          <Icon name="plus" size={16} /> Neu: Task
        </button>

        <div style={{ width: 1, height: 22, background: "var(--border)", margin: "0 4px" }} />

        <ToolbarMenu icon="search" label="Suchen" active={!!search} width={280}>
          {() => (
            <div style={{ padding: 10 }}>
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nach Titel suchen…"
                style={inputStyle}
              />
            </div>
          )}
        </ToolbarMenu>

        <ToolbarMenu icon="user" label="Person" active={!!personFilter} width={260}>
          {(close) => (
            <PersonPicker
              people={people}
              value={personFilter}
              onPick={(id) => {
                setPersonFilter(id);
                close();
              }}
            />
          )}
        </ToolbarMenu>

        <ToolbarMenu
          icon="filter"
          label="Filter"
          badge={activeFilterCount}
          active={activeFilterCount > 0}
          width={240}
        >
          {(close) => (
            <div style={{ padding: 10, display: "grid", gap: 4 }}>
              <div style={menuHead}>{deadlineCol?.label ?? "Deadline"}</div>
              {(
                [
                  ["all", "Alle"],
                  ["overdue", "Überfällig"],
                  ["today", "Heute"],
                  ["week", "Nächste 7 Tage"],
                  ["none", "Ohne Datum"],
                ] as [DeadlineFilter, string][]
              ).map(([val, lbl]) => (
                <button
                  key={val}
                  onClick={() => {
                    setDeadlineFilter(val);
                    close();
                  }}
                  style={{
                    ...menuItem,
                    color: deadlineFilter === val ? "var(--accent)" : "var(--text)",
                    fontWeight: deadlineFilter === val ? 600 : 400,
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          )}
        </ToolbarMenu>

        <ToolbarMenu icon="sort" label="Sortieren" active={!!sortColId} width={260}>
          {() => (
            <div style={{ padding: 10, display: "grid", gap: 8 }}>
              <select
                value={sortColId}
                onChange={(e) => setSortColId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Standard (Reihenfolge)</option>
                {columns
                  .filter((c) => c.key !== "task_id")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
              </select>
              <div style={{ display: "flex", gap: 6 }}>
                {(["asc", "desc"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setSortDir(d)}
                    disabled={!sortColId}
                    style={{
                      ...menuItem,
                      flex: 1,
                      textAlign: "center",
                      border: "1px solid var(--border)",
                      background:
                        sortDir === d ? "var(--active)" : "transparent",
                      color: sortColId ? "var(--text)" : "var(--faint)",
                    }}
                  >
                    {d === "asc" ? "Aufsteigend" : "Absteigend"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </ToolbarMenu>

        <ToolbarMenu
          icon="group"
          label="Gruppen"
          badge={visibleGroupIds.length}
          active={visibleGroupIds.length > 0}
          width={240}
        >
          {() => (
            <div style={{ padding: 10, display: "grid", gap: 2 }}>
              <div style={menuHead}>Sichtbare Gruppen</div>
              <button
                onClick={() => setVisibleGroupIds([])}
                style={{
                  ...menuItem,
                  color:
                    visibleGroupIds.length === 0 ? "var(--accent)" : "var(--text)",
                  fontWeight: visibleGroupIds.length === 0 ? 600 : 400,
                }}
              >
                Alle anzeigen
              </button>
              {groups.map((g) => {
                const on =
                  visibleGroupIds.length === 0 || visibleGroupIds.includes(g.id);
                return (
                  <button
                    key={g.id}
                    onClick={() => toggleGroupVisible(g.id)}
                    style={{
                      ...menuItem,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        border: "1px solid var(--border)",
                        background:
                          visibleGroupIds.includes(g.id)
                            ? "var(--accent)"
                            : "transparent",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {visibleGroupIds.includes(g.id) && (
                        <Icon name="check" size={12} style={{ color: "#fff" }} />
                      )}
                    </span>
                    <span style={{ opacity: on ? 1 : 0.6 }}>{g.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </ToolbarMenu>

        <ToolbarMenu
          icon="eye-off"
          label="Ansichten"
          badge={savedViews.length}
          width={260}
        >
          {(close) => (
            <div style={{ padding: 10, display: "grid", gap: 2 }}>
              <div style={menuHead}>Gespeicherte Ansichten</div>
              {savedViews.length === 0 && (
                <div style={{ padding: 8, color: "var(--faint)", fontSize: 13 }}>
                  Noch keine Ansicht gespeichert.
                </div>
              )}
              {savedViews.map((v) => (
                <div
                  key={v.id}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <button
                    onClick={() => {
                      applyView(v.config);
                      close();
                    }}
                    style={{ ...menuItem, flex: 1 }}
                  >
                    {v.name}
                  </button>
                  <button
                    onClick={() =>
                      startTransition(() => deleteBoardView(boardId, v.id))
                    }
                    title="Ansicht löschen"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--danger)",
                      cursor: "pointer",
                      display: "inline-flex",
                      padding: 4,
                    }}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  saveCurrentView();
                  close();
                }}
                style={{
                  ...menuItem,
                  marginTop: 4,
                  borderTop: "1px solid var(--border)",
                  color: "var(--accent)",
                  fontWeight: 600,
                }}
              >
                + Aktuelle Ansicht speichern
              </button>
            </div>
          )}
        </ToolbarMenu>

        {isEmployee && (
          <ToolbarMenu icon="more" label="Spalten" width={330}>
            {() => <ColumnsManager boardId={boardId} columns={columns} />}
          </ToolbarMenu>
        )}

        {(activeFilterCount > 0 || search || visibleGroupIds.length > 0) && (
          <>
            <button onClick={resetFilters} style={ghostBtn}>
              <Icon name="x" size={14} /> Zurücksetzen
            </button>
            {filterChips.map((chip) => (
              <FilterChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
            ))}
          </>
        )}
      </div>

      {groups
        .filter(
          (g) => visibleGroupIds.length === 0 || visibleGroupIds.includes(g.id),
        )
        .map((g) => (
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
          unreadTasks={unreadTasks}
          currentUserId={currentUserId}
          isEmployee={isEmployee}
          groups={groups}
          showCustomer={showCustomer}
          customerByTask={customerByTask}
          customerIdByTask={customerIdByTask}
          lockedCustomerTasks={lockedCustomerTasks}
          customers={customers}
          onTaskDragStart={onTaskDragStart}
          onGroupDrop={onGroupDrop}
          onMoveToGroup={applyMove}
          dragActive={dragActive}
          autoOpenTaskId={autoOpenTaskId}
          highlightCommentId={highlightCommentId}
        />
      ))}

      <form action={createGroupBound}>
        <button type="submit" style={ghostBtn}>
          <Icon name="plus" size={16} /> Neue Gruppe hinzufügen
        </button>
      </form>
    </div>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: "var(--active)",
        border: "1px solid var(--border)",
        borderRadius: 999,
        padding: "5px 6px 5px 12px",
        fontSize: 13,
        color: "var(--text)",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {label}
      <button
        onClick={onRemove}
        title="Filter entfernen"
        aria-label="Filter entfernen"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          color: "var(--muted)",
          cursor: "pointer",
          padding: 0,
          width: 16,
          opacity: hover ? 1 : 0,
          transition: "opacity 120ms",
        }}
      >
        <Icon name="x" size={13} />
      </button>
    </span>
  );
}

function ToolbarMenu({
  icon,
  label,
  active,
  badge,
  width = 240,
  children,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  badge?: number;
  width?: number;
  children: (close: () => void) => React.ReactNode;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={ref}
        onClick={() =>
          setRect(ref.current?.getBoundingClientRect() ?? null)
        }
        style={{
          ...toolBtn,
          borderColor: active ? "var(--accent)" : "var(--border)",
          color: active ? "var(--text)" : "var(--muted)",
        }}
      >
        <Icon name={icon} size={16} />
        {label}
        {badge ? ` / ${badge}` : ""}
        <Icon name="chevron-down" size={13} style={{ opacity: 0.7 }} />
      </button>
      {rect && (
        <Popover rect={rect} width={width} onClose={() => setRect(null)}>
          {children(() => setRect(null))}
        </Popover>
      )}
    </>
  );
}

function PersonPicker({
  people,
  value,
  onPick,
}: {
  people: Person[];
  value: string;
  onPick: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = people.filter((p) =>
    p.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div style={{ padding: 8 }}>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Suchen…"
        style={inputStyle}
      />
      <div style={{ marginTop: 6, maxHeight: 240, overflowY: "auto" }}>
        <button
          onClick={() => onPick("")}
          style={{ ...menuItem, color: value ? "var(--muted)" : "var(--accent)" }}
        >
          Alle Personen
        </button>
        {filtered.map((p) => (
          <button
            key={p.id}
            onClick={() => onPick(p.id)}
            style={{
              ...menuItem,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: value === p.id ? "var(--active)" : "transparent",
            }}
          >
            <Avatar name={p.name} size={22} />
            <span>{p.name}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 8, color: "var(--faint)", fontSize: 13 }}>
            Keine Treffer.
          </div>
        )}
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const toolBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "7px 12px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 14px",
  color: "var(--muted)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--input-bg)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 10px",
  color: "var(--text)",
  fontSize: 14,
};

const menuItem: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "transparent",
  border: "none",
  borderRadius: 6,
  padding: "8px 10px",
  color: "var(--text)",
  fontSize: 14,
  cursor: "pointer",
};

const menuHead: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "var(--faint)",
  padding: "2px 10px 4px",
  fontWeight: 700,
};
