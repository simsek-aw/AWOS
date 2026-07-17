import Shell from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { listTools } from "@/lib/tools";
import type { Board } from "@/lib/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireSession();

  // The app shell must never white-screen because of a transient data-load
  // error (Supabase can reject the fetch on a network blip / cold start). Load
  // everything defensively and fall back to empty state.
  let activeBoards: Board[] = [];
  const unreadByBoard: Record<string, number> = {};
  let tools: Awaited<ReturnType<typeof listTools>> = [];
  try {
    const supabase = await createServerSupabase();
    const { data: boards } = await supabase
      .from("boards")
      .select("*")
      .order("type", { ascending: true })
      .order("name", { ascending: true })
      .returns<Board[]>();

    // Unread comments per board for the sidebar badge: a task counts as unread
    // when someone else commented after the user last opened it.
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

    // Hide archived boards from the sidebar (filter in JS so it also works
    // before the archived_at migration is applied — undefined = not archived).
    activeBoards = (boards ?? []).filter((b) => !b.archived_at);

    // Tools for the product switcher (employees only; customers stay in the CMS),
    // filtered by per-tool visibility (department / admins).
    tools =
      ctx.profile.role === "employee"
        ? await listTools({
            department: ctx.profile.department,
            isAdmin: ctx.profile.is_admin ?? true,
          })
        : [];
  } catch (e) {
    console.error("AppLayout: data load failed", e);
  }

  return (
    <Shell
      ctx={ctx}
      boards={activeBoards}
      unreadByBoard={unreadByBoard}
      tools={tools}
    >
      {children}
    </Shell>
  );
}
