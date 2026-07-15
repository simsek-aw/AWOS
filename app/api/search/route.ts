import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const roleLabel: Record<string, string> = {
  employee: "Mitarbeiter",
  customer: "Kunde",
};

// Global search across boards, tasks, updates and people. Everything runs
// through the user's RLS-scoped client, so results are automatically limited to
// what the caller may see (customers only their own boards, etc.).
export async function GET(req: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const raw = (url.searchParams.get("q") ?? "").trim();
  const scope = url.searchParams.get("scope") ?? "all";
  // PostgREST treats commas/parentheses as filter syntax and % / _ as wildcards.
  // Strip them so a user's raw query can't break the filter or match everything.
  const q = raw.replace(/[%_(),]/g, " ").trim();
  if (q.length < 2) {
    return NextResponse.json({ boards: [], tasks: [], updates: [], people: [] });
  }
  const like = `%${q}%`;
  const want = (s: string) => scope === "all" || scope === s;

  const [boardsRes, tasksRes, commentsRes, peopleRes] = await Promise.all([
    want("boards")
      ? supabase
          .from("boards")
          .select("id, name, type")
          .ilike("name", like)
          .limit(6)
          .returns<{ id: string; name: string; type: string }[]>()
      : Promise.resolve({ data: [] as { id: string; name: string; type: string }[] }),
    want("tasks")
      ? supabase
          .from("tasks")
          .select("id, title, board_id")
          .ilike("title", like)
          .is("archived_at", null)
          .limit(6)
          .returns<{ id: string; title: string; board_id: string }[]>()
      : Promise.resolve({ data: [] as { id: string; title: string; board_id: string }[] }),
    want("updates")
      ? supabase
          .from("comments")
          .select("id, task_id, body")
          .ilike("body", like)
          .order("created_at", { ascending: false })
          .limit(6)
          .returns<{ id: string; task_id: string; body: string }[]>()
      : Promise.resolve({ data: [] as { id: string; task_id: string; body: string }[] }),
    want("people")
      ? supabase
          .from("profiles")
          .select("id, full_name, role")
          .ilike("full_name", like)
          .limit(6)
          .returns<{ id: string; full_name: string | null; role: string }[]>()
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; role: string }[] }),
  ]);

  // Resolve board names for tasks + the task/board a comment lives on.
  const commentTaskIds = [...new Set((commentsRes.data ?? []).map((c) => c.task_id))];
  const { data: commentTasks } = commentTaskIds.length
    ? await supabase
        .from("tasks")
        .select("id, title, board_id")
        .in("id", commentTaskIds)
        .returns<{ id: string; title: string; board_id: string }[]>()
    : { data: [] as { id: string; title: string; board_id: string }[] };
  const taskById = new Map((commentTasks ?? []).map((t) => [t.id, t]));

  const boardIds = [
    ...new Set([
      ...(tasksRes.data ?? []).map((t) => t.board_id),
      ...(commentTasks ?? []).map((t) => t.board_id),
    ]),
  ];
  const { data: boardRows } = boardIds.length
    ? await supabase
        .from("boards")
        .select("id, name")
        .in("id", boardIds)
        .returns<{ id: string; name: string }[]>()
    : { data: [] as { id: string; name: string }[] };
  const boardName = new Map((boardRows ?? []).map((b) => [b.id, b.name]));

  const boards = (boardsRes.data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    type: b.type,
  }));
  const tasks = (tasksRes.data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    boardId: t.board_id,
    boardName: boardName.get(t.board_id) ?? "Board",
  }));
  const updates = (commentsRes.data ?? [])
    .map((c) => {
      const t = taskById.get(c.task_id);
      if (!t) return null;
      const body = c.body.replace(/\s+/g, " ").trim();
      return {
        id: c.id,
        taskId: c.task_id,
        boardId: t.board_id,
        taskTitle: t.title,
        boardName: boardName.get(t.board_id) ?? "Board",
        snippet: body.length > 90 ? `${body.slice(0, 90)}…` : body,
      };
    })
    .filter(Boolean);
  const people = (peopleRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.full_name ?? "Unbenannt",
    role: roleLabel[p.role] ?? p.role,
  }));

  return NextResponse.json({ boards, tasks, updates, people });
}
