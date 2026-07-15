import AppHeader from "@/components/AppHeader";
import Sidebar from "@/components/Sidebar";
import { requireSession } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Board } from "@/lib/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireSession();
  const supabase = await createServerSupabase();
  const { data: boards } = await supabase
    .from("boards")
    .select("*")
    .order("type", { ascending: true })
    .order("name", { ascending: true })
    .returns<Board[]>();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <AppHeader ctx={ctx} />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Sidebar boards={boards ?? []} />
        <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>{children}</main>
      </div>
    </div>
  );
}
