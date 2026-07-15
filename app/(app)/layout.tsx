import Shell from "@/components/Shell";
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
    <Shell ctx={ctx} boards={boards ?? []}>
      {children}
    </Shell>
  );
}
