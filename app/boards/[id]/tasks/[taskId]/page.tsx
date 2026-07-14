import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { shortId } from "@/components/columns";
import { requireSession } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Board, Column, Comment, Task, TaskValue } from "@/lib/types";
import {
  addComment,
  deleteTask,
  releaseToCustomer,
  saveTask,
} from "../../actions";

// Columns bound to the task row itself, not stored in task_values.
const ROW_BOUND = new Set(["task_id", "name"]);

export default async function TaskDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; taskId: string }>;
  searchParams: Promise<{ released?: string }>;
}) {
  const { id, taskId } = await params;
  const { released } = await searchParams;
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

  // Return-channel wiring (employees only). Two directions:
  //  - this task is the INTERNAL one  -> show the release panel
  //  - this task is the CUSTOMER one  -> show a link to its internal task
  let release: {
    customerBoard: Board;
    statusOptions: { label: string; color: string }[];
  } | null = null;
  let linkedInternal: { taskId: string; boardId: string } | null = null;

  if (isEmployee) {
    const [{ data: asInternal }, { data: asCustomer }] = await Promise.all([
      supabase
        .from("task_links")
        .select("customer_task_id")
        .eq("internal_task_id", taskId)
        .maybeSingle<{ customer_task_id: string }>(),
      supabase
        .from("task_links")
        .select("internal_task_id")
        .eq("customer_task_id", taskId)
        .maybeSingle<{ internal_task_id: string }>(),
    ]);

    if (asInternal) {
      const { data: cTask } = await supabase
        .from("tasks")
        .select("board_id")
        .eq("id", asInternal.customer_task_id)
        .single<{ board_id: string }>();
      if (cTask) {
        const { data: cBoard } = await supabase
          .from("boards")
          .select("*")
          .eq("id", cTask.board_id)
          .single<Board>();
        const { data: statusCol } = await supabase
          .from("columns")
          .select("*")
          .eq("board_id", cTask.board_id)
          .eq("key", "status")
          .maybeSingle<Column>();
        if (cBoard) {
          release = {
            customerBoard: cBoard,
            statusOptions: statusCol?.options.options ?? [],
          };
        }
      }
    }

    if (asCustomer) {
      const { data: iTask } = await supabase
        .from("tasks")
        .select("board_id")
        .eq("id", asCustomer.internal_task_id)
        .single<{ board_id: string }>();
      if (iTask) {
        linkedInternal = {
          taskId: asCustomer.internal_task_id,
          boardId: iTask.board_id,
        };
      }
    }
  }

  const release_ = release
    ? releaseToCustomer.bind(null, id, taskId)
    : null;

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
      <RealtimeRefresh
        channel={`task-${taskId}`}
        subscriptions={[
          { table: "comments", filter: `task_id=eq.${taskId}` },
          { table: "task_values", filter: `task_id=eq.${taskId}` },
          { table: "tasks", filter: `id=eq.${taskId}` },
        ]}
      />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px" }}>
        <a href={`/boards/${id}`} style={{ color: "var(--muted)", fontSize: 14 }}>
          ← {board.name}
        </a>
        <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>
          Task-ID <code>{shortId(task.id)}</code>
        </div>

        {released && (
          <p
            style={{
              marginTop: 12,
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: 14,
              background: "#12301f",
              color: "#7ee2b0",
            }}
          >
            An Kunde freigegeben.
          </p>
        )}

        {linkedInternal && (
          <p style={{ marginTop: 8, fontSize: 13 }}>
            <a
              href={`/boards/${linkedInternal.boardId}/tasks/${linkedInternal.taskId}`}
            >
              ↗ Verknüpfter interner Task
            </a>
          </p>
        )}

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

        {release && release_ && (
          <section
            style={{
              marginTop: 24,
              border: "1px solid #2d4a63",
              background: "#101a24",
              borderRadius: 10,
              padding: 16,
            }}
          >
            <h2 style={{ fontSize: 16, marginTop: 0 }}>
              An Kunde freigeben → {release.customerBoard.name}
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
              Nur dieser Text (und optional der Status) wird für den Kunden
              sichtbar. Interne Kommentare bleiben intern.
            </p>
            <form action={release_} style={{ display: "grid", gap: 10 }}>
              <textarea
                name="body"
                rows={3}
                placeholder="Kurzer Kommentar an den Kunden…"
                style={{ ...inputStyle, resize: "vertical" }}
              />
              {release.statusOptions.length > 0 && (
                <label style={labelStyle}>
                  Status beim Kunden setzen (optional)
                  <select name="status" defaultValue="" style={inputStyle}>
                    <option value="">— nicht ändern —</option>
                    {release.statusOptions.map((o) => (
                      <option key={o.label} value={o.label}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="submit"
                style={{ ...primaryButton, background: "#00a86b" }}
              >
                Freigeben
              </button>
            </form>
          </section>
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
