import { notFound } from "next/navigation";
import { createGroup } from "./actions";
import BoardTable from "@/components/board/BoardTable";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { requireSession } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Board, Column, Group, Task, TaskValue } from "@/lib/types";

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

  // Users selectable as PM/Macher (RLS-scoped: employees see all, a customer
  // sees only themselves).
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .returns<{ id: string; full_name: string | null }[]>();
  const people = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.full_name ?? p.id.slice(0, 8),
  }));

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

  const allTasks = tasks ?? [];

  // Group tasks by group_id. Any task whose group is missing/null falls into
  // the first group so nothing is ever hidden.
  const firstGroupId = groupList[0]?.id ?? null;
  const tasksByGroup = new Map<string, Task[]>();
  for (const g of groupList) tasksByGroup.set(g.id, []);
  for (const t of allTasks) {
    const key =
      t.group_id && tasksByGroup.has(t.group_id)
        ? t.group_id
        : firstGroupId;
    if (key) tasksByGroup.get(key)!.push(t);
  }

  const createGroupBound = createGroup.bind(null, id);

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

        {groupList.map((g) => (
          <BoardTable
            key={g.id}
            boardId={id}
            boardName={board.name}
            group={g}
            columns={columns ?? []}
            tasks={tasksByGroup.get(g.id) ?? []}
            values={values ?? []}
            people={people}
            commentCounts={commentCounts}
            currentUserId={ctx.userId}
            isEmployee={ctx.profile.role === "employee"}
          />
        ))}

        {!groupsProblem && (
          <form action={createGroupBound}>
            <button
              type="submit"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 16px",
                color: "var(--text)",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
              Neue Gruppe hinzufügen
            </button>
          </form>
        )}
      </div>
    </>
  );
}
