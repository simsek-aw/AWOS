// Shared task-list queries used by "Meine Aufgaben" and person pages.
import type { createServerSupabase } from "@/lib/supabase/server";

type DB = Awaited<ReturnType<typeof createServerSupabase>>;

export type PersonTaskRow = {
  id: string;
  title: string;
  board_id: string;
  boardName: string;
  status: string;
  statusColor: string;
  deadline: string;
};

const containsId = (v: unknown, id: string) =>
  Array.isArray(v)
    ? v.map(String).includes(id)
    : v != null && String(v) === id;

/**
 * Every non-archived task across all accessible boards where `personId` is
 * tagged as PM or Macher, with board name, status (+ colour) and deadline.
 * Sorted by deadline (empty last). RLS still scopes what the caller can see.
 */
export async function personTaskRows(
  supabase: DB,
  personId: string,
): Promise<PersonTaskRow[]> {
  const { data: personCols } = await supabase
    .from("columns")
    .select("id")
    .in("key", ["pm", "macher"])
    .returns<{ id: string }[]>();
  const personColIds = (personCols ?? []).map((c) => c.id);
  if (!personColIds.length) return [];

  const { data: mine } = await supabase
    .from("task_values")
    .select("task_id, value")
    .in("column_id", personColIds)
    .returns<{ task_id: string; value: unknown }[]>();
  const taskIds = [
    ...new Set(
      (mine ?? [])
        .filter((m) => containsId(m.value, personId))
        .map((m) => m.task_id),
    ),
  ];
  if (!taskIds.length) return [];

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, board_id")
    .in("id", taskIds)
    .is("archived_at", null)
    .returns<{ id: string; title: string; board_id: string }[]>();
  const boardIds = [...new Set((tasks ?? []).map((t) => t.board_id))];
  if (!boardIds.length) return [];

  const [{ data: boards }, { data: sdCols }] = await Promise.all([
    supabase
      .from("boards")
      .select("id, name")
      .in("id", boardIds)
      .returns<{ id: string; name: string }[]>(),
    supabase
      .from("columns")
      .select("id, board_id, key, options")
      .in("board_id", boardIds)
      .in("key", ["status", "deadline"])
      .returns<
        {
          id: string;
          board_id: string;
          key: string;
          options: { options?: { label: string; color: string }[] };
        }[]
      >(),
  ]);

  const boardName = new Map((boards ?? []).map((b) => [b.id, b.name]));
  const statusColByBoard = new Map<string, string>();
  const deadlineColByBoard = new Map<string, string>();
  const statusColorsByBoard = new Map<string, Map<string, string>>();
  for (const c of sdCols ?? []) {
    if (c.key === "status") {
      statusColByBoard.set(c.board_id, c.id);
      statusColorsByBoard.set(
        c.board_id,
        new Map((c.options?.options ?? []).map((o) => [o.label, o.color])),
      );
    } else deadlineColByBoard.set(c.board_id, c.id);
  }

  const sdColIds = (sdCols ?? []).map((c) => c.id);
  const { data: vals } = sdColIds.length
    ? await supabase
        .from("task_values")
        .select("task_id, column_id, value")
        .in("task_id", taskIds)
        .in("column_id", sdColIds)
        .returns<{ task_id: string; column_id: string; value: unknown }[]>()
    : { data: [] as { task_id: string; column_id: string; value: unknown }[] };
  const valOf = new Map<string, unknown>();
  for (const v of vals ?? []) valOf.set(`${v.task_id}:${v.column_id}`, v.value);

  return (tasks ?? [])
    .map((t) => {
      const sCol = statusColByBoard.get(t.board_id);
      const dCol = deadlineColByBoard.get(t.board_id);
      const status = sCol ? String(valOf.get(`${t.id}:${sCol}`) ?? "") : "";
      const deadline = dCol
        ? String(valOf.get(`${t.id}:${dCol}`) ?? "").slice(0, 10)
        : "";
      const statusColor =
        (status && statusColorsByBoard.get(t.board_id)?.get(status)) ||
        "#6b7189";
      return {
        id: t.id,
        title: t.title,
        board_id: t.board_id,
        boardName: boardName.get(t.board_id) ?? "Board",
        status,
        statusColor,
        deadline,
      };
    })
    .sort((a, b) =>
      (a.deadline || "9999-99-99").localeCompare(b.deadline || "9999-99-99"),
    );
}
