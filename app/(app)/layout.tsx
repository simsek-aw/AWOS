import AppHeader from "@/components/AppHeader";
import NotificationBell from "@/components/NotificationBell";
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
      <div
        style={{
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "0 18px",
          borderBottom: "1px solid #1a1f28",
          background: "#0b0d11",
          flexShrink: 0,
        }}
      >
        <NotificationBell userId={ctx.userId} />
      </div>
      <AppHeader ctx={ctx} />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Sidebar boards={boards ?? []} />
        <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>{children}</main>
      </div>
    </div>
  );
}
