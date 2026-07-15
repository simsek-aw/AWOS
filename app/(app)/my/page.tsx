import { requireSession } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// "Meine Aufgaben" — every task across all accessible boards where the current
// user is PM or Macher. RLS still scopes what's visible.
export default async function MyTasksPage() {
  const ctx = await requireSession();
  const supabase = await createServerSupabase();

  const { data: personCols } = await supabase
    .from("columns")
    .select("id")
    .in("key", ["pm", "macher"])
    .returns<{ id: string }[]>();
  const personColIds = (personCols ?? []).map((c) => c.id);

  // Fetch PM/Macher values and match in JS — jsonb arrays don't play nicely
  // with the `contains` filter, and the volume here is small.
  const { data: mine } = personColIds.length
    ? await supabase
        .from("task_values")
        .select("task_id, value")
        .in("column_id", personColIds)
        .returns<{ task_id: string; value: unknown }[]>()
    : { data: [] as { task_id: string; value: unknown }[] };
  const containsMe = (v: unknown) =>
    Array.isArray(v)
      ? v.map(String).includes(ctx.userId)
      : v != null && String(v) === ctx.userId;
  const taskIds = [
    ...new Set((mine ?? []).filter((m) => containsMe(m.value)).map((m) => m.task_id)),
  ];

  const { data: tasks } = taskIds.length
    ? await supabase
        .from("tasks")
        .select("id, title, board_id")
        .in("id", taskIds)
        .is("archived_at", null)
        .returns<{ id: string; title: string; board_id: string }[]>()
    : { data: [] as { id: string; title: string; board_id: string }[] };

  const boardIds = [...new Set((tasks ?? []).map((t) => t.board_id))];

  // Board names + the status/deadline columns for those boards, in parallel.
  const [{ data: boards }, { data: sdCols }] = await Promise.all([
    boardIds.length
      ? supabase
          .from("boards")
          .select("id, name")
          .in("id", boardIds)
          .returns<{ id: string; name: string }[]>()
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    boardIds.length
      ? supabase
          .from("columns")
          .select("id, board_id, key")
          .in("board_id", boardIds)
          .in("key", ["status", "deadline"])
          .returns<{ id: string; board_id: string; key: string }[]>()
      : Promise.resolve(
          { data: [] as { id: string; board_id: string; key: string }[] },
        ),
  ]);

  const boardName = new Map((boards ?? []).map((b) => [b.id, b.name]));
  const statusColByBoard = new Map<string, string>();
  const deadlineColByBoard = new Map<string, string>();
  for (const c of sdCols ?? []) {
    if (c.key === "status") statusColByBoard.set(c.board_id, c.id);
    else deadlineColByBoard.set(c.board_id, c.id);
  }

  const sdColIds = (sdCols ?? []).map((c) => c.id);
  const { data: vals } = taskIds.length && sdColIds.length
    ? await supabase
        .from("task_values")
        .select("task_id, column_id, value")
        .in("task_id", taskIds)
        .in("column_id", sdColIds)
        .returns<{ task_id: string; column_id: string; value: unknown }[]>()
    : { data: [] as { task_id: string; column_id: string; value: unknown }[] };

  const valOf = new Map<string, unknown>();
  for (const v of vals ?? []) valOf.set(`${v.task_id}:${v.column_id}`, v.value);

  const rows = (tasks ?? [])
    .map((t) => {
      const sCol = statusColByBoard.get(t.board_id);
      const dCol = deadlineColByBoard.get(t.board_id);
      const status = sCol ? String(valOf.get(`${t.id}:${sCol}`) ?? "") : "";
      const deadline = dCol
        ? String(valOf.get(`${t.id}:${dCol}`) ?? "").slice(0, 10)
        : "";
      return { ...t, status, deadline };
    })
    // open first, then by deadline (empty deadlines last)
    .sort((a, b) => {
      const ad = a.deadline || "9999-99-99";
      const bd = b.deadline || "9999-99-99";
      return ad.localeCompare(bd);
    });

  const today = new Date().toISOString().slice(0, 10);
  const fmtDate = (iso: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
  };

  return (
    <div className="page-pad" style={{ padding: "24px 28px", maxWidth: 880 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 16px" }}>
        Meine Aufgaben
      </h1>

      {rows.length === 0 && (
        <p style={{ color: "var(--faint)" }}>
          Dir sind aktuell keine Aufgaben zugewiesen.
        </p>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((t) => {
          const overdue =
            t.deadline && t.deadline < today && t.status !== "Fertig";
          return (
            <a
              key={t.id}
              href={`/boards/${t.board_id}?task=${t.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderLeft: `3px solid ${overdue ? "var(--danger)" : "var(--border)"}`,
                borderRadius: 8,
                padding: "10px 14px",
                textDecoration: "none",
                color: "var(--text)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.title}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {boardName.get(t.board_id) ?? "Board"}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexShrink: 0,
                  fontSize: 13,
                }}
              >
                {t.status && (
                  <span style={{ color: "var(--muted)" }}>{t.status}</span>
                )}
                {t.deadline && (
                  <span style={{ color: overdue ? "var(--danger)" : "var(--muted)" }}>
                    {fmtDate(t.deadline)}
                  </span>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
