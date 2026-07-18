"use client";

import { useState, useTransition } from "react";
import { addTodo, deleteTodo, toggleTodo, type Todo } from "@/app/(app)/todos/actions";
import Icon from "@/components/icons";

// Personal scratchpad: a private quick to-do / notes list on the dashboard.
// Optimistic UI, persisted per user via server actions.
export default function PersonalTodos({ initial }: { initial: Todo[] }) {
  const [todos, setTodos] = useState<Todo[]>(initial);
  const [text, setText] = useState("");
  const [, startTransition] = useTransition();

  const add = () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    // Optimistic row with a temporary id; reconcile when the server responds.
    const tempId = `tmp-${todos.length}-${t.length}-${t.slice(0, 8)}`;
    const optimistic: Todo = {
      id: tempId,
      text: t,
      done: false,
      created_at: "",
    };
    setTodos((prev) => [...prev, optimistic]);
    startTransition(async () => {
      const created = await addTodo(t);
      setTodos((prev) =>
        created
          ? prev.map((x) => (x.id === tempId ? created : x))
          : prev.filter((x) => x.id !== tempId),
      );
    });
  };

  const toggle = (id: string, done: boolean) => {
    setTodos((prev) => prev.map((x) => (x.id === id ? { ...x, done } : x)));
    startTransition(() => {
      toggleTodo(id, done);
    });
  };

  const remove = (id: string) => {
    setTodos((prev) => prev.filter((x) => x.id !== id));
    startTransition(() => {
      deleteTodo(id);
    });
  };

  // Open items first, then completed.
  const sorted = [...todos].sort(
    (a, b) => Number(a.done) - Number(b.done),
  );
  const openCount = todos.filter((t) => !t.done).length;

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <h2 style={{ fontSize: 16, margin: 0 }}>Notizen &amp; To-dos</h2>
        {openCount > 0 && (
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {openCount} offen
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Notiz oder To-do hinzufügen…"
          style={{
            flex: 1,
            minWidth: 0,
            background: "var(--input-bg)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "8px 10px",
            color: "var(--text)",
            fontSize: 14,
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={add}
          disabled={!text.trim()}
          className="glow-hover"
          style={{
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "0 14px",
            fontWeight: 600,
            fontSize: 14,
            cursor: text.trim() ? "pointer" : "default",
            opacity: text.trim() ? 1 : 0.5,
            flexShrink: 0,
          }}
        >
          <Icon name="plus" size={16} />
        </button>
      </div>

      {sorted.length === 0 ? (
        <p style={{ color: "var(--faint)", fontSize: 13, margin: "6px 2px" }}>
          Noch nichts notiert. Schreib deine erste Notiz oben rein.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 2, maxHeight: 260, overflowY: "auto" }}>
          {sorted.map((t) => (
            <div
              key={t.id}
              className="todo-row"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 6px",
                borderRadius: 8,
              }}
            >
              <button
                type="button"
                onClick={() => toggle(t.id, !t.done)}
                aria-label={t.done ? "Als offen markieren" : "Als erledigt markieren"}
                aria-pressed={t.done}
                style={{
                  width: 18,
                  height: 18,
                  flexShrink: 0,
                  borderRadius: 5,
                  border: `1.5px solid ${t.done ? "var(--ok)" : "var(--faint)"}`,
                  background: t.done ? "var(--ok)" : "transparent",
                  color: "#06231a",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                {t.done && <Icon name="check" size={12} strokeWidth={3} />}
              </button>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 14,
                  color: t.done ? "var(--faint)" : "var(--text)",
                  textDecoration: t.done ? "line-through" : "none",
                  overflowWrap: "anywhere",
                }}
              >
                {t.text}
              </span>
              <button
                type="button"
                onClick={() => remove(t.id)}
                className="todo-del"
                aria-label="Löschen"
                title="Löschen"
                style={{
                  flexShrink: 0,
                  background: "transparent",
                  border: "none",
                  color: "var(--faint)",
                  cursor: "pointer",
                  padding: 2,
                  display: "inline-flex",
                }}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
