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

  const { data: groups } = await supabase
    .from("groups")
    .select("*")
    .eq("board_id", id)
    .order("position", { ascending: true })
    .returns<Group[]>();

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

  const groupList = groups ?? [];
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

        <form action={createGroupBound}>
          <input
            type="text"
            name="name"
            placeholder="+ Gruppe hinzufügen…"
            style={{
              background: "var(--surface)",
              border: "1px dashed var(--border)",
              borderRadius: 8,
              padding: "10px 14px",
              color: "var(--text)",
              fontSize: 14,
              fontWeight: 600,
              outline: "none",
              width: 260,
            }}
          />
        </form>
      </div>
    </>
  );
}
