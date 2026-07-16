import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Tool } from "@/lib/types";

// Embedded viewer for a tool of kind "embed": the external tool is shown in an
// iframe inside the AWOS shell so it feels like one platform. Employee-only.
export default async function ToolEmbedPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const ctx = await requireSession();
  if (ctx.profile.role !== "employee") notFound();

  const supabase = await createServerSupabase();
  const { data: tool } = await supabase
    .from("tools")
    .select("*")
    .eq("key", key)
    .maybeSingle<Tool>();

  if (!tool || tool.kind !== "embed" || !tool.url || !tool.enabled) notFound();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 16px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span style={{ fontSize: 18 }}>{tool.icon || "🧩"}</span>
        <strong style={{ fontSize: 15 }}>{tool.name}</strong>
        {tool.description && (
          <span style={{ color: "var(--muted)", fontSize: 13 }}>
            {tool.description}
          </span>
        )}
        <a
          href={tool.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginLeft: "auto",
            fontSize: 13,
            color: "var(--accent)",
            textDecoration: "none",
          }}
        >
          In neuem Tab öffnen ↗
        </a>
      </div>
      <iframe
        src={tool.url}
        title={tool.name}
        style={{ flex: 1, width: "100%", border: "none" }}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
      />
    </div>
  );
}
