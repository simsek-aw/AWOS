"use client";

import { useRef, useState } from "react";
import { deleteTask, duplicateTask } from "@/app/(app)/boards/[id]/actions";
import type { Group } from "@/lib/types";
import Popover from "./Popover";

export default function RowMenu({
  boardId,
  taskId,
  taskTitle,
  groups,
  currentGroupId,
  onOpenDrawer,
  onMove,
}: {
  boardId: string;
  taskId: string;
  taskTitle: string;
  groups: Group[];
  currentGroupId: string;
  onOpenDrawer: () => void;
  onMove: (groupId: string) => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [view, setView] = useState<"root" | "move" | "dup">("root");
  const triggerRef = useRef<HTMLButtonElement>(null);

  const open = () => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    setView("root");
  };
  const close = () => setRect(null);

  const taskHref = `/boards/${boardId}/tasks/${taskId}`;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          open();
        }}
        title="Aktionen"
        style={{
          background: "transparent",
          border: "none",
          color: "var(--muted)",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
          padding: "0 2px",
        }}
      >
        ⋯
      </button>

      {rect && (
        <Popover rect={rect} width={230} onClose={close}>
          <div style={{ padding: 6 }}>
            {view === "root" && (
              <>
                <Item
                  icon="⤢"
                  label="Task öffnen"
                  onClick={() => {
                    close();
                    onOpenDrawer();
                  }}
                />
                <Item
                  icon="↗"
                  label="In neuem Tab öffnen"
                  onClick={() => {
                    close();
                    window.open(taskHref, "_blank", "noopener");
                  }}
                />
                <Item
                  icon="🔗"
                  label="Task-Link kopieren"
                  onClick={() => {
                    close();
                    navigator.clipboard?.writeText(
                      `${window.location.origin}${taskHref}`,
                    );
                  }}
                />
                <Divider />
                <Item
                  icon="→"
                  label="Verschieben nach"
                  chevron
                  onClick={() => setView("move")}
                />
                <Item
                  icon="⧉"
                  label="Duplizieren"
                  chevron
                  onClick={() => setView("dup")}
                />
                <Divider />
                <Item
                  icon="🗑"
                  label="Löschen"
                  danger
                  onClick={() => {
                    close();
                    if (confirm(`Task „${taskTitle}" löschen?`)) {
                      deleteTask(boardId, taskId);
                    }
                  }}
                />
              </>
            )}

            {view === "move" && (
              <>
                <BackRow onBack={() => setView("root")} label="Verschieben nach" />
                {groups.map((g) => (
                  <Item
                    key={g.id}
                    icon={g.id === currentGroupId ? "•" : "◦"}
                    label={g.name}
                    disabled={g.id === currentGroupId}
                    onClick={() => {
                      close();
                      onMove(g.id);
                    }}
                  />
                ))}
              </>
            )}

            {view === "dup" && (
              <>
                <BackRow onBack={() => setView("root")} label="Duplizieren" />
                <Item
                  icon="⧉"
                  label="Mit Inhalten"
                  onClick={() => {
                    close();
                    duplicateTask(boardId, taskId, true);
                  }}
                />
                <Item
                  icon="⌬"
                  label="Nur Titel"
                  onClick={() => {
                    close();
                    duplicateTask(boardId, taskId, false);
                  }}
                />
              </>
            )}
          </div>
        </Popover>
      )}
    </>
  );
}

function Item({
  icon,
  label,
  onClick,
  danger,
  chevron,
  disabled,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
  chevron?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        background: "transparent",
        border: "none",
        borderRadius: 6,
        padding: "8px 10px",
        color: disabled
          ? "var(--faint)"
          : danger
            ? "var(--danger)"
            : "var(--text)",
        fontSize: 14,
        cursor: disabled ? "default" : "pointer",
        textAlign: "left",
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = "var(--active)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span style={{ width: 18, textAlign: "center", opacity: 0.8 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {chevron && <span style={{ color: "var(--faint)" }}>›</span>}
    </button>
  );
}

function BackRow({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onBack();
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid var(--border)",
        padding: "6px 10px 10px",
        color: "var(--muted)",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        marginBottom: 4,
      }}
    >
      ‹ {label}
    </button>
  );
}

function Divider() {
  return (
    <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
  );
}
