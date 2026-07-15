import { notFound } from "next/navigation";
import EditableCell from "@/components/board/EditableCell";
import MentionTextarea from "@/components/board/MentionTextarea";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { shortId } from "@/components/columns";
import { requireSession } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type {
  Attachment,
  Board,
  Column,
  Comment,
  Person,
  Task,
  TaskValue,
} from "@/lib/types";
import {
  addComment,
  deleteAttachment,
  deleteTask,
  releaseComment,
  releaseToCustomer,
  uploadAttachment,
} from "../../actions";

// Columns bound to the task row itself, not stored in task_values.
const ROW_BOUND = new Set(["task_id", "name"]);

export default async function TaskDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; taskId: string }>;
  searchParams: Promise<{ released?: string; err?: string }>;
}) {
  const { id, taskId } = await params;
  const { released, err } = await searchParams;
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

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .returns<{ id: string; full_name: string | null }[]>();
  const people: Person[] = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.full_name ?? p.id.slice(0, 8),
  }));

  const { data: attachments } = await supabase
    .from("attachments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true })
    .returns<Attachment[]>();

  // Signed download URLs (RLS lets us sign only files we may access).
  const files = await Promise.all(
    (attachments ?? []).map(async (a) => {
      const { data } = await supabase.storage
        .from("attachments")
        .createSignedUrl(a.storage_path, 3600);
      return { ...a, url: data?.signedUrl ?? null };
    }),
  );

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
  // The customer task this internal task mirrors (if any) — drives the shared
  // comment thread and the per-comment release buttons.
  let customerTaskId: string | null = null;

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

    customerTaskId = asInternal?.customer_task_id ?? null;

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

  // Comment thread. For an internal task that mirrors a customer task, assemble
  // the SHARED thread: the customer briefing + every internal copy's comments,
  // ordered by time. Otherwise just this task's own comments. (Only employees
  // ever reach an internal task, so the cross-board read stays RLS-safe.)
  let threadTaskIds: string[] = [taskId];
  if (customerTaskId) {
    const { data: sibs } = await supabase
      .from("task_links")
      .select("internal_task_id")
      .eq("customer_task_id", customerTaskId)
      .returns<{ internal_task_id: string }[]>();
    threadTaskIds = [
      customerTaskId,
      ...(sibs ?? []).map((s) => s.internal_task_id),
    ];
  }
  const { data: comments } = await supabase
    .from("comments")
    .select("*")
    .in("task_id", threadTaskIds)
    .order("created_at", { ascending: true })
    .returns<Comment[]>();

  const peopleName = new Map(people.map((p) => [p.id, p.name]));
  const isMirrored = !!customerTaskId;

  const nameColumn = (columns ?? []).find((c) => c.key === "name");
  const comment = addComment.bind(null, id, taskId);
  const remove = deleteTask.bind(null, id, taskId);

  return (
    <>
      <RealtimeRefresh
        channel={`task-${taskId}`}
        subscriptions={[
          // For a mirrored task the thread spans several tasks, so we can't
          // filter by a single task_id — refresh on any comment change.
          isMirrored
            ? { table: "comments" }
            : { table: "comments", filter: `task_id=eq.${taskId}` },
          { table: "task_values", filter: `task_id=eq.${taskId}` },
          { table: "attachments", filter: `task_id=eq.${taskId}` },
          { table: "tasks", filter: `id=eq.${taskId}` },
        ]}
      />
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px" }}>
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
              background: "var(--ok-bg)",
              color: "var(--ok-text)",
            }}
          >
            An Kunde freigegeben.
          </p>
        )}

        {err && (
          <p
            style={{
              marginTop: 12,
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: 14,
              background: "var(--danger-bg)",
              color: "var(--danger)",
            }}
          >
            {err}
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

        <div style={{ marginTop: 12, marginBottom: 4 }}>
          <div style={{ fontSize: 20, fontWeight: 600 }}>
            {nameColumn ? (
              <EditableCell
                boardId={id}
                task={task}
                column={nameColumn}
                value={task.title}
                people={people}
                canEditLabels={isEmployee}
              />
            ) : (
              task.title
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
          {editable.map((c) => (
            <div key={c.id} style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>{c.label}</label>
              <EditableCell
                boardId={id}
                task={task}
                column={c}
                value={valueByColumn.get(c.id)}
                people={people}
                canEditLabels={isEmployee}
              />
            </div>
          ))}
        </div>

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
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
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
          <h2 style={{ fontSize: 16 }}>Dateien</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {files.map((f) => {
              const remove = deleteAttachment.bind(null, id, taskId, f.id, f.storage_path);
              return (
                <div
                  key={f.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    background: "var(--panel)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 14,
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.url ? (
                      <a href={f.url} target="_blank" rel="noopener noreferrer">
                        {f.file_name}
                      </a>
                    ) : (
                      f.file_name
                    )}
                    <span style={{ color: "var(--muted)", marginLeft: 8, fontSize: 12 }}>
                      {formatBytes(f.size_bytes)}
                    </span>
                  </span>
                  <form action={remove}>
                    <button
                      type="submit"
                      title="Löschen"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--danger)",
                        cursor: "pointer",
                        fontSize: 14,
                      }}
                    >
                      ✕
                    </button>
                  </form>
                </div>
              );
            })}
            {files.length === 0 && <p style={{ color: "var(--faint)" }}>Keine Dateien.</p>}
          </div>

          <form
            action={uploadAttachment.bind(null, id, taskId)}
            style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}
          >
            <input
              type="file"
              name="file"
              required
              style={{ flex: 1, minWidth: 200, color: "var(--muted)", fontSize: 14 }}
            />
            <button type="submit" style={primaryButton}>
              Hochladen
            </button>
          </form>
          <p style={{ color: "var(--muted)", fontSize: 12 }}>Max. 10 MB pro Datei.</p>
        </section>

        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 16 }}>Kommentare</h2>
          {isMirrored && (
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
              Gemeinsamer interner Thread aller Abteilungen. Das Briefing des
              Kunden ist enthalten. Mit „An Kunde senden" wird ein einzelner
              Kommentar für den Kunden sichtbar gemacht.
            </p>
          )}
          <div style={{ display: "grid", gap: 10 }}>
            {(comments ?? []).map((cm) => {
              const fromCustomer = cm.task_id === customerTaskId;
              const label = fromCustomer
                ? "Kunde"
                : cm.is_agent
                  ? "AWOS Agent"
                  : cm.author_id === ctx.userId
                    ? "Du"
                    : (cm.author_id && peopleName.get(cm.author_id)) || "Team";
              const canRelease =
                isEmployee &&
                isMirrored &&
                !fromCustomer &&
                !cm.is_agent &&
                !cm.released_at;
              const releaseThis = releaseComment.bind(null, id, taskId, cm.id);
              return (
                <div
                  key={cm.id}
                  style={{
                    ...commentStyle,
                    borderColor: fromCustomer
                      ? "var(--accent)"
                      : "var(--border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {label}
                    </span>
                    {canRelease && (
                      <form action={releaseThis}>
                        <button type="submit" style={sendBtn} title="Diesen Kommentar an den Kunden senden">
                          An Kunde senden →
                        </button>
                      </form>
                    )}
                    {isEmployee && !fromCustomer && cm.released_at && (
                      <span style={{ fontSize: 11, color: "var(--ok-text)" }}>
                        ✓ an Kunde gesendet
                      </span>
                    )}
                  </div>
                  <div>{cm.body}</div>
                </div>
              );
            })}
            {(comments ?? []).length === 0 && (
              <p style={{ color: "var(--faint)" }}>Noch keine Kommentare.</p>
            )}
          </div>

          <form action={comment} style={{ display: "grid", gap: 8, marginTop: 12 }}>
            <MentionTextarea
              people={people}
              name="body"
              placeholder="Kommentar schreiben… (@ erwähnt jemanden)"
            />
            <button type="submit" style={primaryButton}>
              Kommentieren
            </button>
          </form>
        </section>
      </div>
    </>
  );
}


const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  fontSize: 14,
  color: "var(--muted)",
};

const inputStyle: React.CSSProperties = {
  background: "var(--input-bg)",
  border: "1px solid var(--border)",
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

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const commentStyle: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  display: "grid",
  gap: 4,
};

const dangerButton: React.CSSProperties = {
  background: "transparent",
  color: "var(--danger)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 14px",
  cursor: "pointer",
  fontSize: 14,
};

const sendBtn: React.CSSProperties = {
  background: "transparent",
  color: "#00a86b",
  border: "1px solid #00a86b",
  borderRadius: 6,
  padding: "3px 8px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
