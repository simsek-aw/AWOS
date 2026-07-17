import { notFound } from "next/navigation";
import EditableCell from "@/components/board/EditableCell";
import TaskFields from "@/components/board/TaskFields";
import MarkTaskRead from "@/components/board/MarkTaskRead";
import TaskUpdates from "@/components/board/TaskUpdates";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { shortId } from "@/components/columns";
import { requireSession } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type {
  Attachment,
  Board,
  Column,
  Person,
  Task,
  TaskValue,
} from "@/lib/types";
import { deleteAttachment, deleteTask, uploadAttachment } from "../../actions";

export default async function TaskDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; taskId: string }>;
  searchParams: Promise<{ released?: string; err?: string; comment?: string }>;
}) {
  const { id, taskId } = await params;
  const { released, err, comment: highlightComment } = await searchParams;
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
    .is("deleted_at", null)
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

  // Scope selectable/mentionable users to this board (see boards/[id]/page.tsx):
  // employees always; customers only those of this customer board's company.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, customer_id")
    .returns<
      {
        id: string;
        full_name: string | null;
        role: "employee" | "customer";
        customer_id: string | null;
      }[]
    >();
  const people: Person[] = (profiles ?? [])
    .filter((p) =>
      p.role === "employee"
        ? true
        : board.type === "customer" && p.customer_id === board.customer_id,
    )
    .map((p) => ({ id: p.id, name: p.full_name ?? p.id.slice(0, 8) }));

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

  const isEmployee = ctx.profile.role === "employee";

  // Mirror links (employees only). Two directions:
  //  - this task is the INTERNAL copy   -> link to the customer board to reply
  //  - this task is the CUSTOMER task   -> link to the internal task
  // Internal comments never flow to the customer automatically; to answer the
  // customer, the employee replies directly in the customer board.
  let customerLink: { boardId: string; taskId: string; boardName: string } | null =
    null;
  let linkedInternal: { taskId: string; boardId: string } | null = null;
  // The customer task this internal task mirrors (if any) — drives the shared
  // comment thread.
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
        if (cBoard) {
          customerLink = {
            boardId: cBoard.id,
            taskId: asInternal.customer_task_id,
            boardName: cBoard.name,
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

  const isMirrored = !!customerTaskId;
  const nameColumn = (columns ?? []).find((c) => c.key === "name");
  const remove = deleteTask.bind(null, id, taskId);

  return (
    <>
      <MarkTaskRead taskId={taskId} />
      <RealtimeRefresh
        channel={`task-${taskId}`}
        subscriptions={[
          // Comments/likes/activity are handled live inside TaskUpdates.
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

        <div style={{ marginTop: 12 }}>
          <TaskFields
            boardId={id}
            task={task}
            columns={columns ?? []}
            values={values ?? []}
            people={people}
            isEmployee={isEmployee}
          />
        </div>

        {isEmployee && (
          <form action={remove} style={{ marginTop: 12 }}>
            <button type="submit" style={dangerButton}>
              Task löschen
            </button>
          </form>
        )}

        {customerLink && (
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
              Interne Kopie · Kunde: {customerLink.boardName}
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
              Kommentare hier sind <strong>intern</strong> und für den Kunden
              nicht sichtbar. Um dem Kunden zu antworten, schreibe direkt in
              seinem Board.
            </p>
            <a
              href={`/boards/${customerLink.boardId}/tasks/${customerLink.taskId}`}
              style={{
                display: "inline-block",
                background: "#00a86b",
                color: "#fff",
                borderRadius: 8,
                padding: "9px 16px",
                fontWeight: 600,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Im Kundenboard antworten →
            </a>
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

        {isMirrored && (
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 24 }}>
            Updates hier sind <strong>intern</strong> (inkl. der Kundenkommentare,
            blau markiert). Zum Antworten an den Kunden oben „Im Kundenboard
            antworten" nutzen.
          </p>
        )}
        <TaskUpdates
          boardId={id}
          taskId={taskId}
          people={people}
          currentUserId={ctx.userId}
          isEmployee={isEmployee}
          highlightCommentId={highlightComment ?? null}
        />
      </div>
    </>
  );
}


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

const dangerButton: React.CSSProperties = {
  background: "transparent",
  color: "var(--danger)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 14px",
  cursor: "pointer",
  fontSize: 14,
};

