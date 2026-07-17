import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { CURRENT_TOOL_KEY, type Tool } from "@/lib/types";

export { CURRENT_TOOL_KEY };

/** Cache tag for the tools registry; revalidate it when tools change. */
export const TOOLS_TAG = "tools";

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
    id: "awhr",
    key: "awhr",
    name: "AWhr",
    description: "Recruiting & Urlaub (vertraulich)",
    icon: "🧑‍💼",
    color: "#e879f9",
    kind: "internal",
    url: "/tools/awhr",
    position: 3,
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
    position: 4,
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
    position: 5,
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
    position: 6,
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

// The registry is identical for everyone (visibility is applied per-viewer in
// JS), so it's cached across requests and only refetched when a tool changes
// (revalidateTag(TOOLS_TAG)). Uses the service role — no cookies — so it's safe
// inside unstable_cache.
const fetchToolsRaw = unstable_cache(
  async (): Promise<Tool[]> => {
    try {
      const svc = createServiceClient();
      const { data } = await svc
        .from("tools")
        .select("*")
        .order("position", { ascending: true })
        .returns<Tool[]>();
      const db = data ?? [];
      const byKey = new Map(db.map((t) => [t.key, t]));
      const merged = [...db];
      for (const d of DEFAULT_TOOLS) if (!byKey.has(d.key)) merged.push(d);
      merged.sort((a, b) => a.position - b.position);
      return merged;
    } catch {
      return DEFAULT_TOOLS;
    }
  },
  ["awos-tools-registry"],
  { tags: [TOOLS_TAG] },
);

/**
 * All tools for the product switcher: the DB registry merged with the built-in
 * defaults (DB wins per key). Disabled tools are included — the switcher shows
 * them as "coming soon". When a viewer is given, department/admin-restricted
 * tools are filtered out.
 */
export async function listTools(viewer?: {
  department: string | null;
  isAdmin: boolean;
}): Promise<Tool[]> {
  const merged = await fetchToolsRaw();
  return merged.filter((t) => canSeeTool(t, viewer));
}
