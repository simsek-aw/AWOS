"use client";

import { useEffect, useState, useTransition } from "react";
import { postComment } from "@/app/(app)/boards/[id]/actions";
import { shortId } from "@/components/columns";
import { createClient } from "@/lib/supabase/client";
import type { Column, Comment, Person, Task, TaskValue } from "@/lib/types";
import EditableCell from "./EditableCell";
import MentionTextarea from "./MentionTextarea";

const ROW_BOUND = new Set(["task_id"]);

export default function TaskDrawer({
  boardId,
  boardName,
  columns,
  task,
  values,
  people,
  currentUserId,
  onClose,
}: {
  boardId: string;
  boardName: string;
  columns: Column[];
  task: Task;
  values: TaskValue[];
  people: Person[];
  currentUserId: string;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const valueOf = (columnId: string) =>
    values.find((v) => v.column_id === columnId)?.value ?? null;

  const loadComments = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("task_id", task.id)
      .order("created_at", { ascending: true })
      .returns<Comment[]>();
    setComments(data ?? []);
  };

  useEffect(() => {
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    startTransition(async () => {
      await postComment(boardId, task.id, text);
      setBody("");
      await loadComments();
    });
  };

  const nameColumn = columns.find((c) => c.key === "name");
  const fields = columns.filter((c) => !ROW_BOUND.has(c.key) && c.key !== "name");

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 40,
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
          <button onClick={onClose} style={closeBtn} title="Schließen">
            ✕
          </button>
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

          {/* Fields */}
          <div style={{ display: "grid", gap: 12 }}>
            {fields.map((c) => (
              <div key={c.id} style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 12, color: "var(--muted)" }}>{c.label}</label>
                <EditableCell
                  boardId={boardId}
                  task={task}
                  column={c}
                  value={valueOf(c.id)}
                  people={people}
                />
              </div>
            ))}
          </div>

          <a
            href={`/boards/${boardId}/tasks/${task.id}`}
            style={{ display: "inline-block", marginTop: 16, fontSize: 13 }}
          >
            Vollansicht öffnen (Dateien, Freigabe) →
          </a>

          {/* Comments */}
          <h3 style={{ fontSize: 15, marginTop: 26 }}>Kommentare</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {comments.map((cm) => (
              <div key={cm.id} style={commentStyle}>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {cm.is_agent
                    ? "AWOS Agent"
                    : cm.author_id === currentUserId
                      ? "Du"
                      : "Team"}
                </div>
                <div>{cm.body}</div>
              </div>
            ))}
            {comments.length === 0 && (
              <p style={{ color: "var(--faint)", fontSize: 14 }}>Noch keine Kommentare.</p>
            )}
          </div>

          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            <MentionTextarea
              people={people}
              value={body}
              onChange={setBody}
              placeholder="Kommentar schreiben… (@ erwähnt jemanden)"
            />
            <button
              onClick={submit}
              disabled={pending || !body.trim()}
              style={{
                justifySelf: "start",
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "9px 16px",
                fontWeight: 600,
                cursor: pending ? "default" : "pointer",
                opacity: pending || !body.trim() ? 0.6 : 1,
              }}
            >
              Kommentieren
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--muted)",
  fontSize: 16,
  cursor: "pointer",
};

const commentStyle: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  display: "grid",
  gap: 4,
};
