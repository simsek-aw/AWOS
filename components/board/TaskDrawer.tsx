"use client";

import { useEffect, useRef, useState } from "react";
import { shortId } from "@/components/columns";
import Icon from "@/components/icons";
import { toast } from "@/components/toast";
import type { Column, Person, Task, TaskValue } from "@/lib/types";
import EditableCell from "./EditableCell";
import TaskAttachments from "./TaskAttachments";
import TaskFields from "./TaskFields";
import TaskUpdates from "./TaskUpdates";

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
  // Slide-in on mount, slide-out then unmount on close.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const animateOut = useRef(() => {
    setShown(false);
    setTimeout(onClose, 240);
  });
  animateOut.current = () => {
    setShown(false);
    setTimeout(onClose, 240);
  };

  // Push a history entry while the drawer is open so the mobile/browser Back
  // button closes the drawer (returning to the board) instead of navigating
  // away. Both Back and the ✕/backdrop close route through popstate so the
  // pushed entry is always cleaned up.
  useEffect(() => {
    window.history.pushState({ awosDrawer: true }, "");
    const onPop = () => animateOut.current();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const close = () => {
    if (
      typeof window !== "undefined" &&
      (window.history.state as { awosDrawer?: boolean } | null)?.awosDrawer
    ) {
      window.history.back(); // → popstate → animateOut
    } else {
      animateOut.current();
    }
  };

  const nameColumn = columns.find((c) => c.key === "name");

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={close}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 40,
          opacity: shown ? 1 : 0,
          transition: "opacity 240ms ease",
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
          transform: shown ? "translateX(0)" : "translateX(100%)",
          transition: "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)",
          boxShadow: "-12px 0 40px rgba(0,0,0,0.35)",
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
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(
                  `${window.location.origin}/boards/${boardId}?task=${task.id}`,
                );
                toast("Link kopiert");
              }}
              style={closeBtn}
              title="Task-Link kopieren"
            >
              <Icon name="link" size={17} />
            </button>
            <button onClick={close} style={closeBtn} title="Schließen">
              <Icon name="x" size={18} />
            </button>
          </div>
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

          {/* Fields (PM · Macher · Deadline · Status grid, Output below) */}
          <TaskFields
            boardId={boardId}
            task={task}
            columns={columns}
            values={values}
            people={people}
            isEmployee={isEmployee}
          />

          <TaskAttachments boardId={boardId} taskId={task.id} />

          <a
            href={`/boards/${boardId}/tasks/${task.id}`}
            style={{ display: "inline-block", marginTop: 16, fontSize: 13 }}
          >
            Vollansicht öffnen →
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
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
};
