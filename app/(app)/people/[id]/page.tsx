import TaskListView from "@/components/TaskListView";
import { requireSession } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { personTaskRows } from "@/lib/tasks";

export const dynamic = "force-dynamic";

const roleLabel: Record<string, string> = {
  employee: "Mitarbeiter",
  customer: "Kunde",
};

// A person's task list — every task where they are PM or Macher, across all
// boards the viewer can access.
export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  const supabase = await createServerSupabase();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", id)
    .maybeSingle<{ full_name: string | null; role: string }>();

  const name =
    id === ctx.userId
      ? "Meine Aufgaben"
      : (profile?.full_name ?? "Person");
  const rows = await personTaskRows(supabase, id);

  return (
    <div className="page-pad" style={{ padding: "24px 28px", maxWidth: 880 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>{name}</h1>
      {profile?.role && (
        <div style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16 }}>
          {roleLabel[profile.role] ?? profile.role} · Aufgaben (PM oder Macher)
        </div>
      )}
      <TaskListView
        rows={rows}
        emptyText="Dieser Person sind aktuell keine Aufgaben zugewiesen."
      />
    </div>
  );
}
