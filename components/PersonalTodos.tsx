"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addTodo,
  deleteTodo,
  setTodoCustomer,
  toggleTodo,
  type Todo,
} from "@/app/(app)/todos/actions";
import Icon from "@/components/icons";

type Customer = { id: string; name: string };

// Personal scratchpad: a private quick to-do / notes list on the dashboard.
// Each note can optionally be tagged with a customer. Optimistic UI, persisted
// per user via server actions.
export default function PersonalTodos({
  initial,
  customers = [],
}: {
  initial: Todo[];
  customers?: Customer[];
}) {
  const [todos, setTodos] = useState<Todo[]>(initial);
  const [text, setText] = useState("");
  const [newCustomer, setNewCustomer] = useState("");
  const [filter, setFilter] = useState<string>("all"); // all | none | <customerId>
  const [, startTransition] = useTransition();

  const custName = useMemo(
    () => new Map(customers.map((c) => [c.id, c.name])),
    [customers],
  );

  const add = () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    const cust = newCustomer || null;
    const tempId = `tmp-${todos.length}-${t.length}-${t.slice(0, 8)}`;
    const optimistic: Todo = {
      id: tempId,
      text: t,
      done: false,
      created_at: "",
      customer_id: cust,
    };
    setTodos((prev) => [...prev, optimistic]);
    startTransition(async () => {
      const created = await addTodo(t, cust);
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

  const reassign = (id: string, customerId: string | null) => {
    setTodos((prev) =>
      prev.map((x) => (x.id === id ? { ...x, customer_id: customerId } : x)),
    );
    startTransition(() => {
      setTodoCustomer(id, customerId);
    });
  };

  const filtered = todos.filter((t) =>
    filter === "all"
      ? true
      : filter === "none"
        ? !t.customer_id
        : t.customer_id === filter,
  );
  // Open items first, then completed.
  const sorted = [...filtered].sort((a, b) => Number(a.done) - Number(b.done));
  const openCount = filtered.filter((t) => !t.done).length;

  const selectChip: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    maxWidth: 120,
    padding: "2px 6px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "var(--surface-2)",
    color: "var(--muted)",
    cursor: "pointer",
    outline: "none",
  };

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
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <h2 style={{ fontSize: 16, margin: 0 }}>Notizen &amp; To-dos</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {openCount > 0 && (
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {openCount} offen
            </span>
          )}
          {customers.length > 0 && (
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              title="Nach Kunde filtern"
              style={{
                ...selectChip,
                maxWidth: 140,
                background: filter !== "all" ? "var(--active)" : "var(--surface-2)",
                color: filter !== "all" ? "var(--accent)" : "var(--muted)",
              }}
            >
              <option value="all">Alle</option>
              <option value="none">Ohne Kunde</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
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
            minWidth: 140,
            background: "var(--input-bg)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "8px 10px",
            color: "var(--text)",
            fontSize: 14,
            outline: "none",
          }}
        />
        {customers.length > 0 && (
          <select
            value={newCustomer}
            onChange={(e) => setNewCustomer(e.target.value)}
            title="Kunde zuordnen (optional)"
            style={{
              background: "var(--input-bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0 8px",
              color: newCustomer ? "var(--text)" : "var(--muted)",
              fontSize: 13,
              maxWidth: 130,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="">Kunde…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
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
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <Icon name="plus" size={16} />
        </button>
      </div>

      {sorted.length === 0 ? (
        <p style={{ color: "var(--faint)", fontSize: 13, margin: "6px 2px" }}>
          {filter === "all"
            ? "Noch nichts notiert. Schreib deine erste Notiz oben rein."
            : "Keine Notizen für diesen Filter."}
        </p>
      ) : (
        <div style={{ display: "grid", gap: 2, maxHeight: 300, overflowY: "auto" }}>
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
              {customers.length > 0 && (
                <select
                  value={t.customer_id ?? ""}
                  onChange={(e) => reassign(t.id, e.target.value || null)}
                  title="Kunde"
                  style={{
                    ...selectChip,
                    color: t.customer_id ? "var(--accent)" : "var(--faint)",
                    borderColor: t.customer_id
                      ? "color-mix(in srgb, var(--accent) 45%, var(--border))"
                      : "var(--border)",
                    flexShrink: 0,
                  }}
                >
                  <option value="">＋ Kunde</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
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
