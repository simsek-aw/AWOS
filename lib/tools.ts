import { createServerSupabase } from "@/lib/supabase/server";
import { CURRENT_TOOL_KEY, type Tool } from "@/lib/types";

export { CURRENT_TOOL_KEY };

// AWcms (this app) always exists as the anchor tool, even before the tools
// table has been created / seeded. Used as a fallback so the product switcher
// never breaks.
export const AWCMS_FALLBACK: Tool = {
  id: "awcms",
  key: "awcms",
  name: "AWcms",
  description: "Boards, Aufgaben und Kunden",
  icon: "🗂️",
  color: "#00c875",
  kind: "internal",
  url: "/my",
  position: 0,
  enabled: true,
  created_at: "",
};

/**
 * All tools for the product switcher. Employees see enabled tools; admins
 * additionally see disabled ones (so they can manage placeholders). Returns a
 * safe fallback if the tools table doesn't exist yet.
 */
export async function listTools(includeDisabled = false): Promise<Tool[]> {
  try {
    const supabase = await createServerSupabase();
    let query = supabase
      .from("tools")
      .select("*")
      .order("position", { ascending: true });
    if (!includeDisabled) query = query.eq("enabled", true);
    const { data, error } = await query.returns<Tool[]>();
    if (error || !data) return [AWCMS_FALLBACK];
    // Guarantee AWcms is always present.
    return data.some((t) => t.key === CURRENT_TOOL_KEY)
      ? data
      : [AWCMS_FALLBACK, ...data];
  } catch {
    return [AWCMS_FALLBACK];
  }
}
