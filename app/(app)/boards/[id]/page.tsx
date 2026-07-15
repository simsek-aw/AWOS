import { notFound } from "next/navigation";
import BoardTable from "@/components/board/BoardTable";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { requireSession } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Board, Column, Task, TaskValue } from "@/lib/types";

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

  return (
    <>
      <RealtimeRefresh
        channel={`board-${id}`}
        subscriptions={[
          { table: "tasks", filter: `board_id=eq.${id}` },
          { table: "task_values" },
          { table: "comments" },
        ]}
      />
      <div style={{ padding: "24px 28px" }}>
        <BoardTable
          boardId={id}
          boardName={board.name}
          columns={columns ?? []}
          tasks={tasks ?? []}
          values={values ?? []}
          people={people}
          commentCounts={commentCounts}
          currentUserId={ctx.userId}
        />
      </div>
    </>
  );
}
