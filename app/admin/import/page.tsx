import AppHeader from "@/components/AppHeader";
import MondayImport from "@/components/admin/MondayImport";
import { requireAdmin } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Board } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // large imports run as a server action here

export default async function ImportPage() {
  const ctx = await requireAdmin();
  const supabase = await createServerSupabase();

  const [{ data: boards }, { data: profiles }] = await Promise.all([
    supabase
      .from("boards")
      .select("id, name, type")
      .order("name")
      .returns<Board[]>(),
    supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name")
      .returns<{ id: string; full_name: string | null }[]>(),
  ]);

  const people = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.full_name ?? p.id.slice(0, 8),
  }));

  return (
    <>
      <AppHeader ctx={ctx} />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px" }}>
        <a href="/admin" style={{ color: "var(--muted)", fontSize: 14 }}>
          ← Administration
        </a>
        <h1 style={{ fontSize: 24, marginTop: 8 }}>Import aus monday</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>
          Board in monday als <strong>Excel/CSV exportieren</strong> (Board → ⋯ →
          Export). Datei hier als CSV einfügen oder hochladen, Spalten &amp;
          Personen zuordnen, Vorschau prüfen und importieren. Du kannst auch nur
          einen Ausschnitt einfügen – ideal, um häppchenweise vorzugehen.
        </p>
        <MondayImport
          boards={(boards ?? []).map((b) => ({
            id: b.id,
            name: b.name,
            type: b.type,
          }))}
          people={people}
        />
      </main>
    </>
  );
}
