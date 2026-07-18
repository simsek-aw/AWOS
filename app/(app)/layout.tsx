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
  let favoriteIds: string[] = [];
  let tools: Awaited<ReturnType<typeof listTools>> = [];
  try {
    const supabase = await createServerSupabase();

    // Unread badges + boards in parallel. Unread is computed by a single RPC
    // (unread_counts) instead of pulling every task/comment/read into the app.
    const [boardsRes, unreadRes] = await Promise.all([
      supabase
        .from("boards")
        .select("*")
        .order("type", { ascending: true })
        .order("name", { ascending: true })
        .returns<Board[]>(),
      supabase.rpc("unread_counts"),
    ]);

    // Favorites: fetched separately + defensively, so a missing board_favorites
    // table (migration 0035 not yet applied) never takes down the whole shell.
    try {
      const favRes = await supabase
        .from("board_favorites")
        .select("board_id")
        .returns<{ board_id: string }[]>();
      favoriteIds = (favRes.data ?? []).map((r) => r.board_id);
    } catch {
      favoriteIds = [];
    }
    const unreadRows = (unreadRes.data ?? []) as {
      board_id: string;
      cnt: number;
    }[];
    for (const row of unreadRows) {
      unreadByBoard[row.board_id] = Number(row.cnt);
    }

    // Hide archived boards from the sidebar (filter in JS so it also works
    // before the archived_at migration is applied — undefined = not archived).
    activeBoards = (boardsRes.data ?? []).filter((b) => !b.archived_at);

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
      favoriteIds={favoriteIds}
      tools={tools}
    >
      {children}
    </Shell>
  );
}
