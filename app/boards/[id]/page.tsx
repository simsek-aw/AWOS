import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { renderCell } from "@/components/columns";
import { requireSession } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Board, Column, Task, TaskValue } from "@/lib/types";
import { createTask } from "./actions";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  const supabase = await createServerSupabase();

  // RLS returns nothing if the caller may not access this board.
  const { data: board } = await supabase
    .from("boards")
    .select("*")
    .eq("id", id)
    .single<Board>();
  if (!board) notFound();

  const { data: columns } = await supabase
    .from("columns")
    .select("*")
    .eq("board_id", id)
    .order("position", { ascending: true })
    .returns<Column[]>();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("board_id", id)
    .order("created_at", { ascending: true })
    .returns<Task[]>();

  const taskIds = (tasks ?? []).map((t) => t.id);
  const { data: values } = taskIds.length
    ? await supabase
        .from("task_values")
        .select("*")
        .in("task_id", taskIds)
        .returns<TaskValue[]>()
    : { data: [] as TaskValue[] };

  // valueMap[taskId][columnId] = value
  const valueMap = new Map<string, Map<string, unknown>>();
  for (const v of values ?? []) {
    if (!valueMap.has(v.task_id)) valueMap.set(v.task_id, new Map());
    valueMap.get(v.task_id)!.set(v.column_id, v.value);
  }

  const cols = columns ?? [];
  const createTaskWithBoard = createTask.bind(null, id);

  return (
    <>
      <AppHeader ctx={ctx} />
      <RealtimeRefresh
        channel={`board-${id}`}
        subscriptions={[
          { table: "tasks", filter: `board_id=eq.${id}` },
          { table: "task_values" },
        ]}
      />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px" }}>
        <a href="/" style={{ color: "var(--muted)", fontSize: 14 }}>
          ← Boards
        </a>
        <h1 style={{ fontSize: 24, marginTop: 8 }}>{board.name}</h1>

        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c.id} style={thStyle}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(tasks ?? []).map((t) => (
                <tr key={t.id}>
                  {cols.map((c) => (
                    <td key={c.id} style={tdStyle}>
                      {renderCell(c, t, valueMap.get(t.id)?.get(c.id) ?? null)}
                    </td>
                  ))}
                </tr>
              ))}
              {(tasks ?? []).length === 0 && (
                <tr>
                  <td colSpan={cols.length} style={{ ...tdStyle, color: "#5b6472" }}>
                    Noch keine Tasks.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form
          action={createTaskWithBoard}
          style={{ display: "flex", gap: 8, marginTop: 16 }}
        >
          <input
            type="text"
            name="title"
            placeholder="Neuer Task…"
            required
            style={{
              flex: 1,
              background: "#0f1115",
              border: "1px solid #2a2f3a",
              borderRadius: 8,
              padding: "10px 12px",
              color: "var(--text)",
            }}
          />
          <button type="submit" style={addButton}>
            + Hinzufügen
          </button>
        </form>
      </main>
    </>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "var(--muted)",
  borderBottom: "1px solid #222834",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #1a1f28",
  fontSize: 14,
};

const addButton: React.CSSProperties = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "0 16px",
  fontWeight: 600,
  cursor: "pointer",
};
