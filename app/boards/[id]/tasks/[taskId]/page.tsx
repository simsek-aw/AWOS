import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { shortId } from "@/components/columns";
import { requireSession } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Board, Column, Comment, Task, TaskValue } from "@/lib/types";
import { addComment, deleteTask, saveTask } from "../../actions";

// Columns bound to the task row itself, not stored in task_values.
const ROW_BOUND = new Set(["task_id", "name"]);

export default async function TaskDetail({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id, taskId } = await params;
  const ctx = await requireSession();
  const supabase = await createServerSupabase();

  const { data: board } = await supabase
    .from("boards")
    .select("*")
    .eq("id", id)
    .single<Board>();
  const { data: task } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single<Task>();
  if (!board || !task) notFound();

  const { data: columns } = await supabase
    .from("columns")
    .select("*")
    .eq("board_id", id)
    .order("position", { ascending: true })
    .returns<Column[]>();

  const { data: values } = await supabase
    .from("task_values")
    .select("*")
    .eq("task_id", taskId)
    .returns<TaskValue[]>();

  const { data: comments } = await supabase
    .from("comments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true })
    .returns<Comment[]>();

  const valueByColumn = new Map<string, unknown>();
  for (const v of values ?? []) valueByColumn.set(v.column_id, v.value);

  const editable = (columns ?? []).filter((c) => !ROW_BOUND.has(c.key));
  const isEmployee = ctx.profile.role === "employee";

  const save = saveTask.bind(
    null,
    id,
    taskId,
    editable.map((c) => c.id),
  );
  const comment = addComment.bind(null, id, taskId);
  const remove = deleteTask.bind(null, id, taskId);

  return (
    <>
      <AppHeader ctx={ctx} />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px" }}>
        <a href={`/boards/${id}`} style={{ color: "var(--muted)", fontSize: 14 }}>
          ← {board.name}
        </a>
        <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>
          Task-ID <code>{shortId(task.id)}</code>
        </div>

        <form action={save} style={{ display: "grid", gap: 14, marginTop: 12 }}>
          <label style={labelStyle}>
            Name
            <input
              type="text"
              name="title"
              defaultValue={task.title}
              required
              style={inputStyle}
            />
          </label>

          {editable.map((c) => (
            <label key={c.id} style={labelStyle}>
              {c.label}
              <ColumnInput column={c} value={valueByColumn.get(c.id)} />
            </label>
          ))}

          <button type="submit" style={primaryButton}>
            Speichern
          </button>
        </form>

        {isEmployee && (
          <form action={remove} style={{ marginTop: 12 }}>
            <button type="submit" style={dangerButton}>
              Task löschen
            </button>
          </form>
        )}

        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 16 }}>Kommentare</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {(comments ?? []).map((cm) => (
              <div key={cm.id} style={commentStyle}>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {cm.is_agent
                    ? "AWOS Agent"
                    : cm.author_id === ctx.userId
                      ? "Du"
                      : "Team"}
                </div>
                <div>{cm.body}</div>
              </div>
            ))}
            {(comments ?? []).length === 0 && (
              <p style={{ color: "#5b6472" }}>Noch keine Kommentare.</p>
            )}
          </div>

          <form action={comment} style={{ display: "grid", gap: 8, marginTop: 12 }}>
            <textarea
              name="body"
              rows={3}
              placeholder="Kommentar schreiben…"
              required
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <button type="submit" style={primaryButton}>
              Kommentieren
            </button>
          </form>
        </section>
      </main>
    </>
  );
}

function ColumnInput({ column, value }: { column: Column; value: unknown }) {
  const name = `col_${column.id}`;
  const current = value == null ? "" : String(value);

  if (column.type === "status") {
    const options = column.options.options ?? [];
    return (
      <select name={name} defaultValue={current} style={inputStyle}>
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.label} value={o.label}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  const type =
    column.type === "date"
      ? "date"
      : column.type === "link"
        ? "url"
        : column.type === "number"
          ? "number"
          : "text";

  return <input type={type} name={name} defaultValue={current} style={inputStyle} />;
}

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  fontSize: 14,
  color: "var(--muted)",
};

const inputStyle: React.CSSProperties = {
  background: "#0f1115",
  border: "1px solid #2a2f3a",
  borderRadius: 8,
  padding: "10px 12px",
  color: "var(--text)",
  fontSize: 15,
  fontFamily: "inherit",
};

const primaryButton: React.CSSProperties = {
  justifySelf: "start",
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "10px 18px",
  fontWeight: 600,
  cursor: "pointer",
};

const commentStyle: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid #222834",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  display: "grid",
  gap: 4,
};

const dangerButton: React.CSSProperties = {
  background: "transparent",
  color: "#ff9aa2",
  border: "1px solid #55303a",
  borderRadius: 8,
  padding: "8px 14px",
  cursor: "pointer",
  fontSize: 14,
};
