import { notFound } from "next/navigation";
import BoardView from "@/components/board/BoardView";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { requireSession } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Board, Column, Group, Task, TaskValue } from "@/lib/types";

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ task?: string; comment?: string }>;
}) {
  const { id } = await params;
  const { task: openTaskParam, comment: highlightComment } = await searchParams;
  const ctx = await requireSession();
  const supabase = await createServerSupabase();

  // RLS returns nothing if the caller may not access this board.
  const { data: board } = await supabase
    .from("boards")
    .select("*")
    .eq("id", id)
    .single<Board>();
  if (!board) notFound();

  // Independent queries run in parallel — sequential awaits multiply the
  // Vercel↔Supabase round-trip latency and were a big part of the click delay.
  const [
    { data: columns },
    { data: groups, error: groupsError },
    { data: tasks },
    { data: profiles },
  ] = await Promise.all([
    supabase
      .from("columns")
      .select("*")
      .eq("board_id", id)
      .order("position", { ascending: true })
      .returns<Column[]>(),
    supabase
      .from("groups")
      .select("*")
      .eq("board_id", id)
      .order("position", { ascending: true })
      .returns<Group[]>(),
    supabase
      .from("tasks")
      .select("*")
      .eq("board_id", id)
      .is("archived_at", null)
      .order("created_at", { ascending: true })
      .returns<Task[]>(),
    supabase
      .from("profiles")
      .select("id, full_name, role, customer_id")
      .returns<
        {
          id: string;
          full_name: string | null;
          role: "employee" | "customer";
          customer_id: string | null;
        }[]
      >(),
  ]);
  if (groupsError) {
    console.error("boards/[id]: fetching groups failed", { boardId: id, groupsError });
  }

  const taskIds = (tasks ?? []).map((t) => t.id);

  // Users selectable as PM/Macher. Scope them to the board so a customer of
  // one company is never taggable on another company's board:
  //  - customer board  -> employees + customers of THIS board's customer
  //  - internal board   -> employees only
  const people = (profiles ?? [])
    .filter((p) =>
      p.role === "employee"
        ? true
        : board.type === "customer" && p.customer_id === board.customer_id,
    )
    .map((p) => ({ id: p.id, name: p.full_name ?? p.id.slice(0, 8) }));

  // Values, comments and this user's read markers all depend on taskIds.
  const [{ data: values }, { data: commentRows }, { data: readRows }] =
    taskIds.length
      ? await Promise.all([
          supabase
            .from("task_values")
            .select("*")
            .in("task_id", taskIds)
            .returns<TaskValue[]>(),
          supabase
            .from("comments")
            .select("task_id, author_id, created_at")
            .in("task_id", taskIds)
            .returns<
              { task_id: string; author_id: string | null; created_at: string }[]
            >(),
          supabase
            .from("task_reads")
            .select("task_id, last_read_at")
            .eq("user_id", ctx.userId)
            .in("task_id", taskIds)
            .returns<{ task_id: string; last_read_at: string }[]>(),
        ])
      : [
          { data: [] as TaskValue[] },
          {
            data: [] as {
              task_id: string;
              author_id: string | null;
              created_at: string;
            }[],
          },
          { data: [] as { task_id: string; last_read_at: string }[] },
        ];
  const commentCounts: Record<string, number> = {};
  // Newest comment authored by someone OTHER than the current user, per task.
  const latestOther: Record<string, string> = {};
  for (const r of commentRows ?? []) {
    commentCounts[r.task_id] = (commentCounts[r.task_id] ?? 0) + 1;
    if (r.author_id && r.author_id !== ctx.userId) {
      if (!latestOther[r.task_id] || r.created_at > latestOther[r.task_id]) {
        latestOther[r.task_id] = r.created_at;
      }
    }
  }
  const lastRead: Record<string, string> = {};
  for (const r of readRows ?? []) lastRead[r.task_id] = r.last_read_at;
  // Unread = has a newer comment by someone else than the user last read.
  const unreadTasks = Object.keys(latestOther).filter(
    (taskId) => !lastRead[taskId] || lastRead[taskId] < latestOther[taskId],
  );

  // On an internal board, show which customer each task belongs to. Two sources:
  //  - mirrored tasks  -> the origin customer board's name (read-only, "locked")
  //  - manual tasks     -> the task's own customer_id tag (editable picker)
  const showCustomer = board.type === "internal";
  const customerByTask: Record<string, string> = {};
  const customerIdByTask: Record<string, string> = {};
  const lockedCustomerTasks: string[] = [];
  let customers: { id: string; name: string }[] = [];
  if (showCustomer) {
    // Customers available for the manual tag picker.
    const { data: custs } = await supabase
      .from("customers")
      .select("id, name")
      .order("name", { ascending: true })
      .returns<{ id: string; name: string }[]>();
    customers = custs ?? [];
    const custName = new Map(customers.map((c) => [c.id, c.name]));

    // Manual tags on internally-created tasks.
    for (const t of tasks ?? []) {
      if (t.customer_id) {
        customerIdByTask[t.id] = t.customer_id;
        const n = custName.get(t.customer_id);
        if (n) customerByTask[t.id] = n;
      }
    }

    // Mirror links override + lock the customer (it reflects the origin board).
    if (taskIds.length) {
      const { data: links } = await supabase
        .from("task_links")
        .select("internal_task_id, customer_task_id")
        .in("internal_task_id", taskIds)
        .returns<{ internal_task_id: string; customer_task_id: string }[]>();
      const custTaskIds = [
        ...new Set((links ?? []).map((l) => l.customer_task_id)),
      ];
      if (custTaskIds.length) {
        const { data: ctasks } = await supabase
          .from("tasks")
          .select("id, board_id")
          .in("id", custTaskIds)
          .returns<{ id: string; board_id: string }[]>();
        const boardIds = [...new Set((ctasks ?? []).map((t) => t.board_id))];
        const { data: cboards } = await supabase
          .from("boards")
          .select("id, name")
          .in("id", boardIds)
          .returns<{ id: string; name: string }[]>();
        const boardName = new Map((cboards ?? []).map((b) => [b.id, b.name]));
        const taskBoardName = new Map(
          (ctasks ?? []).map((t) => [t.id, boardName.get(t.board_id)]),
        );
        for (const l of links ?? []) {
          const name = taskBoardName.get(l.customer_task_id);
          if (name) {
            customerByTask[l.internal_task_id] = name;
            lockedCustomerTasks.push(l.internal_task_id);
          }
        }
      }
    }
  }

  let groupList = groups ?? [];

  // If the groups query itself errored (most commonly: the `groups` table
  // does not exist because migration 0009 has not been applied), we cannot
  // render the board normally. Surface a clear diagnostic in-app instead of
  // crashing with an opaque "server-side exception" digest.
  let groupsProblem: string | null = groupsError?.message ?? null;

  // Safety net: a board should never render with zero groups. Normally
  // create_board() seeds one and 0009_groups.sql backfilled existing boards,
  // but if one ever ends up empty (edge case, manual DB edit, …) provision a
  // default group on the fly instead of showing a blank board.
  if (!groupsProblem && groupList.length === 0) {
    const { data: created, error: createError } = await supabase
      .from("groups")
      .insert({ board_id: id, name: "Aufgaben", position: 0 })
      .select("*")
      .single<Group>();
    if (createError) {
      console.error("boards/[id]: default-group provisioning failed", {
        boardId: id,
        createError,
      });
      groupsProblem = createError.message;
    }
    if (created) groupList = [created];
  }

  return (
    <>
      <RealtimeRefresh
        channel={`board-${id}`}
        subscriptions={[
          { table: "tasks", filter: `board_id=eq.${id}` },
          { table: "task_values" },
          { table: "comments" },
          { table: "groups", filter: `board_id=eq.${id}` },
        ]}
      />
      <div
        className="page-pad"
        style={{
          padding: "24px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          {board.name}
        </h1>

        {groupsProblem && (
          <div
            style={{
              background: "rgba(226, 68, 92, 0.12)",
              border: "1px solid var(--danger)",
              borderRadius: 8,
              padding: "16px 18px",
              color: "var(--text)",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            <strong style={{ display: "block", marginBottom: 6, fontSize: 15 }}>
              Gruppen können nicht geladen werden
            </strong>
            Die Datenbank-Migration für Gruppen wurde noch nicht angewendet.
            Bitte führe <code>supabase/migrations/0009_groups.sql</code> im
            Supabase-SQL-Editor aus und lade die Seite neu.
            <div
              style={{
                marginTop: 10,
                padding: "8px 10px",
                background: "var(--surface-2)",
                borderRadius: 6,
                fontFamily: "monospace",
                fontSize: 12,
                color: "var(--muted)",
                wordBreak: "break-word",
              }}
            >
              {groupsProblem}
            </div>
          </div>
        )}

        {!groupsProblem && (
          <BoardView
            boardId={id}
            boardName={board.name}
            columns={columns ?? []}
            groups={groupList}
            tasks={tasks ?? []}
            values={values ?? []}
            people={people}
            commentCounts={commentCounts}
            unreadTasks={unreadTasks}
            currentUserId={ctx.userId}
            isEmployee={ctx.profile.role === "employee"}
            showCustomer={showCustomer}
            customerByTask={customerByTask}
            customerIdByTask={customerIdByTask}
            lockedCustomerTasks={lockedCustomerTasks}
            customers={customers}
            autoOpenTaskId={openTaskParam ?? null}
            highlightCommentId={highlightComment ?? null}
          />
        )}
      </div>
    </>
  );
}
