import { createServerSupabase } from "@/lib/supabase/server";
import { CURRENT_TOOL_KEY, type Tool } from "@/lib/types";

export { CURRENT_TOOL_KEY };

// The tools the platform ships with by default. AWcms is this app (the anchor);
// the others are "coming soon" placeholders that always show in the switcher so
// it looks like a real suite even before they're wired up. DB rows with the
// same key override these (so the team can rename / enable / point them via the
// admin UI).
export const DEFAULT_TOOLS: Tool[] = [
  {
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
  },
  {
    id: "awmeet",
    key: "awmeet",
    name: "AWmeet",
    description: "Meetings transkribieren, zusammenfassen und To-Dos ableiten",
    icon: "🎙️",
    color: "#579bfc",
    kind: "link",
    url: null,
    position: 1,
    enabled: false,
    created_at: "",
  },
  {
    id: "awcreative",
    key: "awcreative",
    name: "AWcreative",
    description: "Produkte zu einer Bilderserie / Ads generieren",
    icon: "🎨",
    color: "#fdab3d",
    kind: "link",
    url: null,
    position: 2,
    enabled: false,
    created_at: "",
  },
  {
    id: "awtime",
    key: "awtime",
    name: "AWtime",
    description: "Zeiterfassung",
    icon: "⏱️",
    color: "#e2445c",
    kind: "link",
    url: null,
    position: 3,
    enabled: false,
    created_at: "",
  },
];

// Kept for compatibility: the anchor tool if nothing else is available.
export const AWCMS_FALLBACK: Tool = DEFAULT_TOOLS[0];

/**
 * All tools for the product switcher: the DB registry merged with the built-in
 * defaults (DB wins per key). Disabled tools are included — the switcher shows
 * them as "coming soon". Safe if the tools table doesn't exist yet.
 */
export async function listTools(): Promise<Tool[]> {
  let db: Tool[] = [];
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("tools")
      .select("*")
      .order("position", { ascending: true })
      .returns<Tool[]>();
    if (!error && data) db = data;
  } catch {
    db = [];
  }

  const byKey = new Map(db.map((t) => [t.key, t]));
  const merged = [...db];
  for (const d of DEFAULT_TOOLS) if (!byKey.has(d.key)) merged.push(d);
  merged.sort((a, b) => a.position - b.position);
  return merged;
}
