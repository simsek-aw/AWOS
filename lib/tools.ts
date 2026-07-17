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
    url: "/boards",
    position: 0,
    enabled: true,
    created_at: "",
  },
  {
    id: "awideogram",
    key: "awideogram",
    name: "AWideogram",
    description: "Bildgenerierung mit Layout-Kontrolle (Ideogram 4.0)",
    icon: "🖼️",
    color: "#a25ddc",
    kind: "internal",
    url: "/tools/awideogram",
    position: 1,
    enabled: true,
    created_at: "",
  },
  {
    id: "awcompose",
    key: "awcompose",
    name: "AWcompose",
    description: "Produktfoto exakt auf einen (KI-)Hintergrund montieren",
    icon: "🧩",
    color: "#2dd4bf",
    kind: "internal",
    url: "/tools/awcompose",
    position: 2,
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
    position: 3,
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
    position: 4,
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
    position: 5,
    enabled: false,
    created_at: "",
  },
];

// Kept for compatibility: the anchor tool if nothing else is available.
export const AWCMS_FALLBACK: Tool = DEFAULT_TOOLS[0];

/** Whether a viewer may see a tool, given its visibility setting. */
function canSeeTool(
  tool: Tool,
  viewer?: { department: string | null; isAdmin: boolean },
): boolean {
  const vis = tool.visibility ?? "all";
  if (vis === "all") return true;
  if (!viewer) return true; // no viewer context → don't hide
  if (viewer.isAdmin) return true; // admins see everything
  if (vis === "admins") return false;
  return viewer.department === vis; // department-scoped
}

/**
 * All tools for the product switcher: the DB registry merged with the built-in
 * defaults (DB wins per key). Disabled tools are included — the switcher shows
 * them as "coming soon". When a viewer is given, department/admin-restricted
 * tools are filtered out. Safe if the tools table doesn't exist yet.
 */
export async function listTools(viewer?: {
  department: string | null;
  isAdmin: boolean;
}): Promise<Tool[]> {
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
  return merged.filter((t) => canSeeTool(t, viewer));
}
