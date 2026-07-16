"use server";

import { requireAdmin } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export type ImportColumn = {
  id: string;
  key: string;
  label: string;
  type: string;
  statusOptions?: string[];
};

/** Columns of a board, for the import mapping UI. Employee-only. */
export async function getImportColumns(
  boardId: string,
): Promise<ImportColumn[]> {
  await requireAdmin();
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("columns")
    .select("id, key, label, type, position, options")
    .eq("board_id", boardId)
    .order("position", { ascending: true })
    .returns<
      {
        id: string;
        key: string;
        label: string;
        type: string;
        position: number;
        options: { options?: { label: string }[] };
      }[]
    >();
  return (data ?? []).map((c) => ({
    id: c.id,
    key: c.key,
    label: c.label,
    type: c.type,
    statusOptions:
      c.type === "status"
        ? (c.options?.options ?? []).map((o) => o.label)
        : undefined,
  }));
}

export type ImportRow = {
  group?: string;
  title: string;
  customerName?: string;
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
): Promise<{ created: number; groups: number; createdIds: string[] }> {
  await requireAdmin();
  if (!rows?.length) return { created: 0, groups: 0, createdIds: [] };
  const supabase = await createServerSupabase();

  // Valid columns for this board (never trust client-supplied ids). We also
  // need type/options to auto-extend status columns with imported labels.
  const { data: cols } = await supabase
    .from("columns")
    .select("id, type, options")
    .eq("board_id", boardId)
    .returns<
      { id: string; type: string; options: { options?: { label: string; color: string }[] } }[]
    >();
  const validCols = new Set((cols ?? []).map((c) => c.id));
  // Status values are mapped to existing options in the UI, so we no longer
  // auto-create new status options here (that polluted the status column).

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

  // Customer-tag resolution (for the "Kunde" column). Match by name
  // (case-insensitive); create a customer record if it doesn't exist yet.
  const needCustomers = rows.some((r) => r.customerName?.trim());
  const customerIdByName = new Map<string, string>();
  if (needCustomers) {
    const { data: custs } = await supabase
      .from("customers")
      .select("id, name")
      .returns<{ id: string; name: string }[]>();
    for (const c of custs ?? [])
      customerIdByName.set(c.name.trim().toLowerCase(), c.id);
  }
  const resolveCustomer = async (name?: string): Promise<string | null> => {
    const n = (name ?? "").trim();
    if (!n) return null;
    const hit = customerIdByName.get(n.toLowerCase());
    if (hit) return hit;
    const { data: created } = await supabase
      .from("customers")
      .insert({ name: n })
      .select("id")
      .single<{ id: string }>();
    if (created) {
      customerIdByName.set(n.toLowerCase(), created.id);
      return created.id;
    }
    return null;
  };

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

  // Pre-resolve every distinct group + customer once (creates missing), then
  // BULK insert tasks and values in chunks — a per-row loop would time out on
  // large boards (1000+ rows).
  const valid = rows.filter((r) => String(r.title ?? "").trim());
  const distinctGroups = new Set(valid.map((r) => (r.group ?? "").trim()));
  for (const g of distinctGroups) await ensureGroup(g || undefined);
  const distinctCust = new Set(
    valid.map((r) => (r.customerName ?? "").trim()).filter(Boolean),
  );
  for (const c of distinctCust) await resolveCustomer(c);

  const groupIdFor = (name?: string) => {
    const n = (name ?? "").trim();
    return n ? (groupByName.get(n.toLowerCase()) ?? defaultGroupId) : defaultGroupId;
  };
  const custIdFor = (name?: string) => {
    const n = (name ?? "").trim();
    return n ? (customerIdByName.get(n.toLowerCase()) ?? null) : null;
  };
  const chunk = <T>(arr: T[], n: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  };

  const createdIds: string[] = [];
  const valueRows: { task_id: string; column_id: string; value: unknown }[] = [];
  for (const batch of chunk(valid, 400)) {
    const objs = batch.map((r) => ({
      board_id: boardId,
      group_id: groupIdFor(r.group),
      title: String(r.title).trim(),
      customer_id: custIdFor(r.customerName),
    }));
    const { data: inserted, error } = await supabase
      .from("tasks")
      .insert(objs)
      .select("id")
      .returns<{ id: string }[]>();
    if (error) {
      console.error("import: task insert failed", error);
      throw new Error(`Import fehlgeschlagen: ${error.message}`);
    }
    const ids = (inserted ?? []).map((x) => x.id);
    for (let i = 0; i < batch.length; i++) {
      const id = ids[i];
      if (!id) continue;
      createdIds.push(id);
      for (const v of batch[i].values ?? []) {
        if (
          validCols.has(v.columnId) &&
          v.value != null &&
          !(typeof v.value === "string" && v.value.trim() === "") &&
          !(Array.isArray(v.value) && v.value.length === 0)
        ) {
          valueRows.push({ task_id: id, column_id: v.columnId, value: v.value });
        }
      }
    }
  }
  for (const vb of chunk(valueRows, 500)) {
    await supabase.from("task_values").upsert(vb, { onConflict: "task_id,column_id" });
  }

  return { created: createdIds.length, groups: createdGroups, createdIds };
}

/** Undo an import: delete the tasks it created (their values cascade). */
export async function undoImport(boardId: string, taskIds: string[]) {
  await requireAdmin();
  if (!taskIds.length) return;
  const supabase = await createServerSupabase();
  await supabase.from("tasks").delete().in("id", taskIds);
}
