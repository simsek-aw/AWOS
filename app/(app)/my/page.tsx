import TaskListView from "@/components/TaskListView";
import { requireSession } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { personTaskRows } from "@/lib/tasks";

export const dynamic = "force-dynamic";

// "Meine Aufgaben" — every task across all accessible boards where the current
// user is PM or Macher. RLS still scopes what's visible.
export default async function MyTasksPage() {
  const ctx = await requireSession();
  const supabase = await createServerSupabase();
  const rows = await personTaskRows(supabase, ctx.userId);

  return (
    <div className="page-pad page-enter" style={{ padding: "24px 28px", maxWidth: 880 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 16px" }}>
        Meine Aufgaben
      </h1>
      <TaskListView
        rows={rows}
        emptyText="Dir sind aktuell keine Aufgaben zugewiesen."
      />
    </div>
  );
}
