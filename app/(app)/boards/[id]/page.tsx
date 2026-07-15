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

  const { data: columns } = await supabase
    .from("columns")
    .select("*")
    .eq("board_id", id)
    .order("position", { ascending: true })
    .returns<Column[]>();

  const { data: groups, error: groupsError } = await supabase
    .from("groups")
    .select("*")
    .eq("board_id", id)
    .order("position", { ascending: true })
    .returns<Group[]>();
  if (groupsError) {
    console.error("boards/[id]: fetching groups failed", { boardId: id, groupsError });
  }

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

  // Users selectable as PM/Macher. Scope them to the board so a customer of
  // one company is never taggable on another company's board:
  //  - customer board  -> employees + customers of THIS board's customer
  //  - internal board   -> employees only
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
  const people = (profiles ?? [])
    .filter((p) =>
      p.role === "employee"
        ? true
        : board.type === "customer" && p.customer_id === board.customer_id,
    )
    .map((p) => ({ id: p.id, name: p.full_name ?? p.id.slice(0, 8) }));

  // Comment counts per task (RLS-scoped) for the 💬 badge in the name cell.
  const { data: commentRows } = taskIds.length
    ? await supabase
        .from("comments")
        .select("task_id")
        .in("task_id", taskIds)
        .returns<{ task_id: string }[]>()
    : { data: [] as { task_id: string }[] };
  const commentCounts: Record<string, number> = {};
  for (const r of commentRows ?? []) {
    commentCounts[r.task_id] = (commentCounts[r.task_id] ?? 0) + 1;
  }

  // On an internal board, show which customer each (mirrored) task belongs to.
  // The customer board's name is the company identifier (e.g. "1&1", "GEFU").
  const showCustomer = board.type === "internal";
  const customerByTask: Record<string, string> = {};
  if (showCustomer && taskIds.length) {
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
        if (name) customerByTask[l.internal_task_id] = name;
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
            currentUserId={ctx.userId}
            isEmployee={ctx.profile.role === "employee"}
            showCustomer={showCustomer}
            customerByTask={customerByTask}
            autoOpenTaskId={openTaskParam ?? null}
            highlightCommentId={highlightComment ?? null}
          />
        )}
      </div>
    </>
  );
}
