import Shell from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Board } from "@/lib/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireSession();
  const supabase = await createServerSupabase();
  const { data: boards } = await supabase
    .from("boards")
    .select("*")
    .order("type", { ascending: true })
    .order("name", { ascending: true })
    .returns<Board[]>();

  // Unread comments per board for the sidebar badge: a task counts as unread
  // when someone else commented after the user last opened it.
  const unreadByBoard: Record<string, number> = {};
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, board_id")
    .is("archived_at", null)
    .returns<{ id: string; board_id: string }[]>();
  const taskIds = (tasks ?? []).map((t) => t.id);
  if (taskIds.length) {
    const [{ data: comments }, { data: reads }] = await Promise.all([
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
    ]);
    const latestOther: Record<string, string> = {};
    for (const c of comments ?? []) {
      if (c.author_id && c.author_id !== ctx.userId) {
        if (!latestOther[c.task_id] || c.created_at > latestOther[c.task_id])
          latestOther[c.task_id] = c.created_at;
      }
    }
    const lastRead: Record<string, string> = {};
    for (const r of reads ?? []) lastRead[r.task_id] = r.last_read_at;
    const boardOf = new Map((tasks ?? []).map((t) => [t.id, t.board_id]));
    for (const taskId of Object.keys(latestOther)) {
      if (!lastRead[taskId] || lastRead[taskId] < latestOther[taskId]) {
        const b = boardOf.get(taskId);
        if (b) unreadByBoard[b] = (unreadByBoard[b] ?? 0) + 1;
      }
    }
  }

  return (
    <Shell ctx={ctx} boards={boards ?? []} unreadByBoard={unreadByBoard}>
      {children}
    </Shell>
  );
}
