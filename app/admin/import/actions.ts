"use server";

import { requireEmployee } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export type ImportColumn = {
  id: string;
  key: string;
  label: string;
  type: string;
};

/** Columns of a board, for the import mapping UI. Employee-only. */
export async function getImportColumns(
  boardId: string,
): Promise<ImportColumn[]> {
  await requireEmployee();
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("columns")
    .select("id, key, label, type, position")
    .eq("board_id", boardId)
    .order("position", { ascending: true })
    .returns<(ImportColumn & { position: number })[]>();
  return (data ?? []).map((c) => ({
    id: c.id,
    key: c.key,
    label: c.label,
    type: c.type,
  }));
}

export type ImportRow = {
  group?: string;
  title: string;
  values: { columnId: string; value: unknown }[];
};

/**
 * Import rows into a board: ensures the referenced groups exist, then creates
 * tasks and their column values. Internal/admin only — creating tasks this way
 * never triggers the mirror (that fires on customer boards via comments/tags).
 */
export async function importBoardRows(
  boardId: string,
  rows: ImportRow[],
): Promise<{ created: number; groups: number }> {
  await requireEmployee();
  if (!rows?.length) return { created: 0, groups: 0 };
  const supabase = await createServerSupabase();

  // Valid column ids for this board (never trust client-supplied ids).
  const { data: cols } = await supabase
    .from("columns")
    .select("id")
    .eq("board_id", boardId)
    .returns<{ id: string }[]>();
  const validCols = new Set((cols ?? []).map((c) => c.id));

  // Existing groups by lowercased name.
  const { data: existingGroups } = await supabase
    .from("groups")
    .select("id, name, position")
    .eq("board_id", boardId)
    .order("position", { ascending: true })
    .returns<{ id: string; name: string; position: number }[]>();
  const groupByName = new Map(
    (existingGroups ?? []).map((g) => [g.name.trim().toLowerCase(), g.id]),
  );
  let maxPos = Math.max(-1, ...(existingGroups ?? []).map((g) => g.position));
  let defaultGroupId = existingGroups?.[0]?.id ?? null;
  let createdGroups = 0;

  const ensureGroup = async (name?: string): Promise<string | null> => {
    const n = (name ?? "").trim();
    if (!n) {
      if (defaultGroupId) return defaultGroupId;
      const { data: g } = await supabase
        .from("groups")
        .insert({ board_id: boardId, name: "Importiert", position: ++maxPos })
        .select("id")
        .single<{ id: string }>();
      defaultGroupId = g?.id ?? null;
      if (g) createdGroups++;
      return defaultGroupId;
    }
    const key = n.toLowerCase();
    const hit = groupByName.get(key);
    if (hit) return hit;
    const { data: g } = await supabase
      .from("groups")
      .insert({ board_id: boardId, name: n, position: ++maxPos })
      .select("id")
      .single<{ id: string }>();
    if (g) {
      groupByName.set(key, g.id);
      createdGroups++;
      return g.id;
    }
    return defaultGroupId;
  };

  let created = 0;
  for (const row of rows) {
    const title = String(row.title ?? "").trim();
    if (!title) continue;
    const groupId = await ensureGroup(row.group);
    const { data: task } = await supabase
      .from("tasks")
      .insert({ board_id: boardId, group_id: groupId, title })
      .select("id")
      .single<{ id: string }>();
    if (!task) continue;
    created++;

    const valueRows = (row.values ?? [])
      .filter(
        (v) =>
          validCols.has(v.columnId) &&
          v.value != null &&
          !(typeof v.value === "string" && v.value.trim() === "") &&
          !(Array.isArray(v.value) && v.value.length === 0),
      )
      .map((v) => ({ task_id: task.id, column_id: v.columnId, value: v.value }));
    if (valueRows.length) {
      await supabase
        .from("task_values")
        .upsert(valueRows, { onConflict: "task_id,column_id" });
    }
  }

  return { created, groups: createdGroups };
}
