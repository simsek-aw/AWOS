"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  bulkMoveToGroup,
  bulkSetPeople,
  bulkSetStatus,
  createTask,
  deleteGroup,
  deleteTasks,
  markTaskRead,
  renameGroup,
} from "@/app/(app)/boards/[id]/actions";
import { toast } from "@/components/toast";
import { deadlineUrgency, formatDate } from "@/lib/format";
import type {
  Column,
  Group,
  Person,
  StatusOption,
  Task,
  TaskValue,
} from "@/lib/types";
import Icon from "@/components/icons";
import { AvatarStack } from "./Avatar";
import CustomerCell from "./CustomerCell";
import EditableCell from "./EditableCell";
import { statusPillStyle, urgencyPillStyle } from "./pills";
import RowMenu from "./RowMenu";
import TaskDrawer from "./TaskDrawer";

const INTERACTIVE = "input, select, textarea, button, a, [contenteditable='true']";

function accentFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 70% 55%)`;
}

// Fixed per-column widths so the layout is stable and columns don't resize with
// their content (a long task name no longer widens the Name column).
const CHECKBOX_W = 40;
const CUSTOMER_W = 140;
function colWidth(c: Column): number {
  if (c.key === "task_id") return 96;
  if (c.key === "name") return 300;
  if (c.type === "person") return 140;
  if (c.type === "status") return 170;
  if (c.type === "date") return 190;
  return 170; // link / text / number
}

export default function BoardTable({
  boardId,
  boardName,
  group,
  columns,
  tasks,
  values,
  people,
  commentCounts,
  unreadTasks = [],
  currentUserId,
  isEmployee,
  groups,
  showCustomer = false,
  customerByTask = {},
  customerIdByTask = {},
  lockedCustomerTasks = [],
  customers = [],
  onTaskDragStart,
  onGroupDrop,
  onReorder,
  onMoveToGroup,
  dragActive = false,
  sortColId = "",
  sortDir = "asc",
  onHeaderSort,
  autoOpenTaskId = null,
  highlightCommentId = null,
}: {
  boardId: string;
  boardName: string;
  group: Group;
  columns: Column[];
  tasks: Task[];
  values: TaskValue[];
  people: Person[];
  commentCounts: Record<string, number>;
  unreadTasks?: string[];
  currentUserId: string;
  isEmployee: boolean;
  groups: Group[];
  showCustomer?: boolean;
  customerByTask?: Record<string, string>;
  customerIdByTask?: Record<string, string>;
  lockedCustomerTasks?: string[];
  customers?: { id: string; name: string }[];
  onTaskDragStart?: (taskId: string) => void;
  onGroupDrop?: (groupId: string) => void;
  onReorder?: (groupId: string, orderedIds: string[]) => void;
  onMoveToGroup?: (taskId: string, groupId: string) => void;
  dragActive?: boolean;
  sortColId?: string;
  sortDir?: "asc" | "desc";
  onHeaderSort?: (columnId: string) => void;
  autoOpenTaskId?: string | null;
  highlightCommentId?: string | null;
}) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [bulkMenu, setBulkMenu] = useState<
    null | "status" | "move" | "pm" | "macher"
  >(null);
  const [dropId, setDropId] = useState<string | null>(null);

  // Reorder within this group: move `draggedId` to just before `targetId`.
  const reorderBefore = (draggedId: string, targetId: string) => {
    const ids = tasks.map((t) => t.id);
    if (!ids.includes(draggedId) || draggedId === targetId) return;
    const without = ids.filter((id) => id !== draggedId);
    const at = without.indexOf(targetId);
    without.splice(at < 0 ? without.length : at, 0, draggedId);
    onReorder?.(group.id, without);
  };
  // When a drag starts on an interactive control (input/checkbox/status/…) we
  // must NOT hijack it as a row drag — this lets the whole row be draggable
  // while cell editing still works.
  const dragBlocked = useRef(false);

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

  const lockedSet = useMemo(
    () => new Set(lockedCustomerTasks),
    [lockedCustomerTasks],
  );

  // Which tasks in this group have unread comments. Local state so opening a
  // task clears its highlight immediately (optimistic), before the next load.
  const [unread, setUnread] = useState<Set<string>>(() => new Set(unreadTasks));
  useEffect(() => setUnread(new Set(unreadTasks)), [unreadTasks]);

  const openTaskAndRead = (taskId: string) => {
    setOpenTaskId(taskId);
    if (unread.has(taskId)) {
      setUnread((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      markTaskRead(taskId);
    }
  };

  // Open the drawer automatically when arriving from a notification link
  // (?task=…) and the task lives in this group.
  useEffect(() => {
    if (autoOpenTaskId && tasks.some((t) => t.id === autoOpenTaskId)) {
      setOpenTaskId(autoOpenTaskId);
      markTaskRead(autoOpenTaskId);
      setUnread((prev) => {
        if (!prev.has(autoOpenTaskId)) return prev;
        const next = new Set(prev);
        next.delete(autoOpenTaskId);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenTaskId]);

  // Delete/Backspace deletes the selected rows (unless typing in a field or a
  // drawer is open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (selected.size === 0 || openTaskId) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && el.closest("input, textarea, select, [contenteditable='true']"))
        return;
      e.preventDefault();
      const ids = [...selected];
      const n = ids.length;
      if (confirm(`${n} Task${n > 1 ? "s" : ""} löschen?`)) {
        deleteTasks(boardId, ids);
        setSelected(new Set());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, openTaskId, boardId]);

  const openTask = tasks.find((t) => t.id === openTaskId) ?? null;
  const createTaskBound = createTask.bind(null, boardId, group.id);
  const accent = accentFor(group.name);

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

  // --- Bulk actions on selected rows --------------------------------------
  const statusOptions =
    columns.find((c) => c.type === "status")?.options.options ?? [];
  const afterBulk = () => {
    setSelected(new Set());
    setBulkMenu(null);
  };
  const applyStatus = (label: string) => {
    bulkSetStatus(boardId, [...selected], label);
    toast("Status aktualisiert");
    afterBulk();
  };
  const applyMove = (gid: string) => {
    bulkMoveToGroup(boardId, [...selected], gid);
    toast("Verschoben");
    afterBulk();
  };
  const applyPerson = (key: "pm" | "macher", id: string) => {
    bulkSetPeople(boardId, [...selected], key, id ? [id] : []);
    toast(id ? "Zugewiesen" : "Zuweisung entfernt");
    afterBulk();
  };

  const isDropTarget = dragActive && dragOver;

  return (
    <div
      onDragOver={(e) => {
        if (!onGroupDrop) return;
        e.preventDefault();
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={(e) => {
        // Only clear when the pointer actually leaves the container.
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOver(false);
      }}
      onDrop={(e) => {
        if (!onGroupDrop) return;
        e.preventDefault();
        setDragOver(false);
        onGroupDrop(group.id);
      }}
      style={{
        borderLeft: `4px solid ${accent}`,
        borderRadius: 6,
        overflow: "hidden",
        background: "var(--surface)",
        border: `1px solid ${isDropTarget ? "var(--accent)" : "var(--border)"}`,
        borderLeftWidth: 4,
        boxShadow: isDropTarget
          ? "0 0 0 2px var(--accent) inset"
          : undefined,
        transition: "box-shadow 120ms, border-color 120ms",
      }}
    >
      {/* Group header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 14px",
          userSelect: "none",
        }}
      >
        <span
          onClick={() => setCollapsed((c) => !c)}
          style={{ color: accent, fontSize: 13, cursor: "pointer" }}
        >
          {collapsed ? "▸" : "▾"}
        </span>
        {renaming ? (
          <input
            autoFocus
            defaultValue={group.name}
            onBlur={(e) => {
              setRenaming(false);
              renameGroup(boardId, group.id, e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setRenaming(false);
            }}
            style={{
              color: accent,
              fontWeight: 700,
              fontSize: 18,
              background: "var(--input-bg)",
              border: `1px solid ${accent}`,
              borderRadius: 6,
              padding: "2px 8px",
            }}
          />
        ) : (
          <span
            onClick={() => setRenaming(true)}
            title="Zum Umbenennen klicken"
            style={{ color: accent, fontWeight: 700, fontSize: 18, cursor: "text" }}
          >
            {group.name}
          </span>
        )}
        <span style={{ color: "var(--muted)", fontSize: 13, marginLeft: 6 }}>
          {tasks.length}
        </span>
        <button
          onClick={() => {
            if (confirm(`Gruppe „${group.name}" löschen? Tasks wandern in eine andere Gruppe.`))
              deleteGroup(boardId, group.id);
          }}
          title="Gruppe löschen"
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: "none",
            color: "var(--faint)",
            cursor: "pointer",
            fontSize: 15,
          }}
        >
          ×
        </button>
      </div>

      {selected.size > 0 && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-2)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              padding: "8px 14px",
            }}
          >
            <strong style={{ fontSize: 13 }}>{selected.size} ausgewählt</strong>
            <BulkBtn
              label="Status"
              on={bulkMenu === "status"}
              onClick={() => setBulkMenu((m) => (m === "status" ? null : "status"))}
            />
            <BulkBtn
              label="Verschieben"
              on={bulkMenu === "move"}
              onClick={() => setBulkMenu((m) => (m === "move" ? null : "move"))}
            />
            <BulkBtn
              label="PM"
              on={bulkMenu === "pm"}
              onClick={() => setBulkMenu((m) => (m === "pm" ? null : "pm"))}
            />
            <BulkBtn
              label="Macher"
              on={bulkMenu === "macher"}
              onClick={() => setBulkMenu((m) => (m === "macher" ? null : "macher"))}
            />
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  const ids = [...selected];
                  if (confirm(`${ids.length} Task(s) löschen?`)) {
                    deleteTasks(boardId, ids);
                    afterBulk();
                  }
                }}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "5px 10px",
                  color: "var(--danger)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Löschen
              </button>
              <button
                onClick={afterBulk}
                title="Auswahl aufheben"
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "5px 10px",
                  color: "var(--muted)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Aufheben
              </button>
            </div>
          </div>

          {bulkMenu && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                padding: "0 14px 10px",
              }}
            >
              {bulkMenu === "status" &&
                [...statusOptions.map((o) => o.label), ""].map((label) => (
                  <BulkChip
                    key={label || "leeren"}
                    label={label || "Leeren"}
                    onClick={() => applyStatus(label)}
                  />
                ))}
              {bulkMenu === "move" &&
                groups.map((g) => (
                  <BulkChip key={g.id} label={g.name} onClick={() => applyMove(g.id)} />
                ))}
              {(bulkMenu === "pm" || bulkMenu === "macher") && (
                <>
                  {people.map((p) => (
                    <BulkChip
                      key={p.id}
                      label={p.name}
                      onClick={() => applyPerson(bulkMenu, p.id)}
                    />
                  ))}
                  <BulkChip label="Leeren" onClick={() => applyPerson(bulkMenu, "")} />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {!collapsed && (
        <>
        <div className="board-desktop" style={{ overflowX: "auto" }}>
          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              tableLayout: "fixed",
              minWidth:
                CHECKBOX_W +
                columns.reduce((sum, c) => sum + colWidth(c), 0) +
                (showCustomer ? CUSTOMER_W : 0),
            }}
          >
            <colgroup>
              <col style={{ width: CHECKBOX_W }} />
              {columns.map((c) => (
                <Fragment key={c.id}>
                  <col style={{ width: colWidth(c) }} />
                  {showCustomer && c.key === "task_id" && (
                    <col style={{ width: CUSTOMER_W }} />
                  )}
                </Fragment>
              ))}
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...th, width: 40, textAlign: "center" }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                {columns.map((c) => {
                  const centered = c.type === "status" || c.type === "person";
                  const arrow =
                    sortColId === c.id ? (sortDir === "asc" ? " ▲" : " ▼") : "";
                  return (
                    <Fragment key={c.id}>
                      <th
                        onClick={() => onHeaderSort?.(c.id)}
                        title="Sortieren: auf/ab/aus"
                        style={{
                          ...th,
                          textAlign: centered ? "center" : "left",
                          cursor: onHeaderSort ? "pointer" : undefined,
                          color: sortColId === c.id ? "var(--text)" : th.color,
                          userSelect: "none",
                        }}
                      >
                        {c.label}
                        {arrow}
                      </th>
                      {showCustomer && c.key === "task_id" && (
                        <th
                          onClick={() => onHeaderSort?.("__customer")}
                          title="Sortieren: auf/ab/aus"
                          style={{
                            ...th,
                            cursor: onHeaderSort ? "pointer" : undefined,
                            color:
                              sortColId === "__customer" ? "var(--text)" : th.color,
                            userSelect: "none",
                          }}
                        >
                          Kunde
                          {sortColId === "__customer"
                            ? sortDir === "asc"
                              ? " ▲"
                              : " ▼"
                            : ""}
                        </th>
                      )}
                    </Fragment>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {tasks.map((t) => {
                const isSel = selected.has(t.id);
                const isOpen = openTaskId === t.id;
                const isHover = hoveredId === t.id;
                return (
                  <tr
                    key={t.id}
                    draggable={!!onTaskDragStart}
                    onMouseDown={(e) => {
                      // Block row-drag only when the gesture starts on a control.
                      dragBlocked.current = !!(e.target as HTMLElement).closest(
                        INTERACTIVE,
                      );
                    }}
                    onDragStart={(e) => {
                      if (!onTaskDragStart || dragBlocked.current) {
                        e.preventDefault();
                        return;
                      }
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", t.id);
                      onTaskDragStart(t.id);
                    }}
                    onMouseEnter={() => setHoveredId(t.id)}
                    onMouseLeave={() =>
                      setHoveredId((cur) => (cur === t.id ? null : cur))
                    }
                    onDragOver={(e) => {
                      if (!onReorder) return;
                      e.preventDefault();
                      if (dropId !== t.id) setDropId(t.id);
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                      setDropId((cur) => (cur === t.id ? null : cur));
                    }}
                    onDrop={(e) => {
                      if (!onReorder) return;
                      const draggedId = e.dataTransfer.getData("text/plain");
                      setDropId(null);
                      if (draggedId && tasks.some((x) => x.id === draggedId)) {
                        e.preventDefault();
                        e.stopPropagation();
                        reorderBefore(draggedId, t.id);
                      }
                      // else: cross-group move — let it bubble to the group drop.
                    }}
                    style={{
                      background: isOpen
                        ? "var(--active)"
                        : isSel
                          ? "var(--surface-2)"
                          : isHover
                            ? "var(--surface-2)"
                            : undefined,
                      cursor: onTaskDragStart ? "grab" : undefined,
                      boxShadow:
                        dropId === t.id ? "inset 0 2px 0 var(--accent)" : undefined,
                    }}
                  >
                    <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 2,
                          visibility: isHover ? "visible" : "hidden",
                        }}
                      >
                        <RowMenu
                          boardId={boardId}
                          taskId={t.id}
                          taskTitle={t.title}
                          groups={groups}
                          currentGroupId={group.id}
                          onOpenDrawer={() => openTaskAndRead(t.id)}
                          onMove={(gid) => onMoveToGroup?.(t.id, gid)}
                        />
                      </span>
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggleOne(t.id)}
                        style={{ marginLeft: 2 }}
                      />
                    </td>
                    {columns.map((c) => {
                      const isStatus = c.type === "status";
                      const isPerson = c.type === "person";
                      return (
                        <Fragment key={c.id}>
                        <td
                          style={{
                            ...td,
                            padding: isStatus ? 0 : td.padding,
                            textAlign: isPerson ? "center" : "left",
                          }}
                        >
                          {c.key === "name" ? (
                            <div
                              onClick={() => openTaskAndRead(t.id)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 8,
                                cursor: "pointer",
                                minWidth: 0,
                              }}
                              title={t.title}
                            >
                              <span
                                style={{
                                  fontWeight: 500,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  minWidth: 0,
                                }}
                              >
                                {t.title}
                              </span>
                              <span
                                style={{
                                  ...commentBtn,
                                  position: "relative",
                                  color: unread.has(t.id)
                                    ? "var(--accent)"
                                    : commentCounts[t.id]
                                      ? "var(--muted)"
                                      : "var(--faint)",
                                }}
                              >
                                <Icon name="message" size={16} />
                                {commentCounts[t.id] ? (
                                  <span style={countBadge}>{commentCounts[t.id]}</span>
                                ) : null}
                                {unread.has(t.id) && (
                                  <span
                                    style={{
                                      position: "absolute",
                                      top: -3,
                                      right: -4,
                                      width: 8,
                                      height: 8,
                                      borderRadius: "50%",
                                      background: "var(--danger)",
                                      border: "1px solid var(--surface)",
                                    }}
                                  />
                                )}
                              </span>
                            </div>
                          ) : (
                            <EditableCell
                              boardId={boardId}
                              task={t}
                              column={c}
                              value={valueOf(t.id, c.id)}
                              people={people}
                              canEditLabels={isEmployee}
                              fullWidthStatus
                            />
                          )}
                        </td>
                        {showCustomer && c.key === "task_id" && (
                          <td style={td}>
                            <CustomerCell
                              boardId={boardId}
                              taskId={t.id}
                              customers={customers}
                              currentId={customerIdByTask[t.id] ?? null}
                              currentName={customerByTask[t.id] ?? null}
                              locked={lockedSet.has(t.id)}
                            />
                          </td>
                        )}
                        </Fragment>
                      );
                    })}
                  </tr>
                );
              })}

              {tasks.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length + 1 + (showCustomer ? 1 : 0)}
                    style={{ ...td, color: "var(--faint)" }}
                  >
                    Noch keine Tasks.
                  </td>
                </tr>
              )}

              <AddTaskRow
                action={createTaskBound}
                colSpan={columns.length + (showCustomer ? 1 : 0)}
              />
            </tbody>

            {tasks.length > 0 && (
              <tfoot>
                <tr>
                  <td style={footTd} />
                  {columns.map((c) => (
                    <Fragment key={c.id}>
                      <td style={{ ...footTd, textAlign: "center" }}>
                        <FooterCell
                          column={c}
                          tasks={tasks}
                          valueOf={valueOf}
                          peopleById={peopleById}
                        />
                      </td>
                      {showCustomer && c.key === "task_id" && (
                        <td style={footTd} />
                      )}
                    </Fragment>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Mobile: cards */}
        <div className="board-cards">
          {tasks.map((t) => {
            const statusCol = columns.find((c) => c.type === "status");
            const statusVal = statusCol
              ? String(valueOf(t.id, statusCol.id) ?? "")
              : "";
            const statusColor =
              statusOptions.find((o) => o.label === statusVal)?.color ?? "#6b7189";
            const deadlineCol = columns.find((c) => c.key === "deadline");
            const deadline = deadlineCol
              ? String(valueOf(t.id, deadlineCol.id) ?? "").slice(0, 10)
              : "";
            const urgency =
              deadline && statusVal !== "Fertig" ? deadlineUrgency(deadline) : null;
            const personNames = (key: string): string[] => {
              const col = columns.find((c) => c.key === key);
              if (!col) return [];
              const v = valueOf(t.id, col.id);
              const ids = Array.isArray(v) ? v.map(String) : v ? [String(v)] : [];
              return ids.map((id) => peopleById.get(id) ?? "?");
            };
            const pm = personNames("pm");
            const macher = personNames("macher");
            return (
              <div
                key={t.id}
                onClick={() => openTaskAndRead(t.id)}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  background: "var(--surface)",
                  padding: 12,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    alignItems: "flex-start",
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{t.title}</span>
                  <span
                    style={{
                      ...commentBtn,
                      position: "relative",
                      color: unread.has(t.id)
                        ? "var(--accent)"
                        : commentCounts[t.id]
                          ? "var(--muted)"
                          : "var(--faint)",
                    }}
                  >
                    <Icon name="message" size={16} />
                    {commentCounts[t.id] ? (
                      <span style={countBadge}>{commentCounts[t.id]}</span>
                    ) : null}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 10,
                  }}
                >
                  {statusVal && (
                    <span style={statusPillStyle(statusColor)}>{statusVal}</span>
                  )}
                  {pm.length > 0 && <AvatarStack names={pm} size={22} />}
                  {macher.length > 0 && <AvatarStack names={macher} size={22} />}
                  {deadline && (
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {formatDate(deadline)}
                    </span>
                  )}
                  {urgency && (
                    <span style={urgencyPillStyle(urgency.tone)}>{urgency.label}</span>
                  )}
                </div>
              </div>
            );
          })}
          <form
            action={createTaskBound}
            onClick={(e) => e.stopPropagation()}
            style={{ marginTop: 2 }}
          >
            <input
              type="text"
              name="title"
              placeholder="+ Task hinzufügen"
              required
              autoComplete="off"
              style={{
                width: "100%",
                background: "var(--input-bg)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 12px",
                color: "var(--text)",
                fontSize: 14,
              }}
            />
          </form>
        </div>
        </>
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
          isEmployee={isEmployee}
          highlightCommentId={
            openTaskId === autoOpenTaskId ? highlightCommentId : null
          }
          onClose={() => setOpenTaskId(null)}
        />
      )}
    </div>
  );
}

/** Monday-style add row: a subtle inline input with an Enter hint on focus. */
function AddTaskRow({
  action,
  colSpan,
}: {
  action: (fd: FormData) => void;
  colSpan: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <>
      <tr>
        <td style={{ borderRight: "none" }} />
        <td colSpan={colSpan} style={{ ...td, borderRight: "none", padding: 6 }}>
          <form action={action}>
            <input
              type="text"
              name="title"
              placeholder="+ Task hinzufügen"
              required
              autoComplete="off"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={{
                width: "100%",
                maxWidth: 420,
                background: focused ? "var(--input-bg)" : "transparent",
                border: `1px solid ${focused ? "var(--accent)" : "transparent"}`,
                borderRadius: 6,
                padding: "9px 12px",
                color: "var(--text)",
                fontSize: 14,
                outline: "none",
              }}
            />
          </form>
        </td>
      </tr>
      {focused && (
        <tr>
          <td style={{ borderRight: "none" }} />
          <td
            colSpan={colSpan}
            style={{ padding: "0 12px 8px", borderRight: "none" }}
          >
            <span style={{ color: "var(--faint)", fontSize: 12 }}>
              <strong style={{ color: "var(--muted)" }}>Enter</strong> drücken um
              Task zu erstellen
            </span>
          </td>
        </tr>
      )}
    </>
  );
}

function BulkBtn({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: on ? "var(--active)" : "transparent",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "5px 10px",
        color: "var(--text)",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function BulkChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 999,
        padding: "5px 12px",
        color: "var(--text)",
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
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
      const idList = Array.isArray(v) ? v.map(String) : v ? [String(v)] : [];
      for (const id of idList) {
        if (seen.has(id)) continue;
        seen.add(id);
        const name = peopleById.get(id);
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
