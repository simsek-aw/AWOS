import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { listTools } from "@/lib/tools";
import type { Tool } from "@/lib/types";

// AWOS platform home: a launcher of the tools the user can access. Customers
// only have the CMS, so they go straight to their boards.
export default async function Home() {
  const ctx = await requireSession();
  if (ctx.profile.role !== "employee") redirect("/boards");

  const tools = await listTools({
    department: ctx.profile.department,
    isAdmin: ctx.profile.is_admin ?? true,
  });

  const hrefFor = (t: Tool): string | undefined => {
    if (t.status === "maintenance") return undefined;
    if (!t.enabled) return undefined;
    if (t.kind === "internal") return t.url ?? "/";
    if (t.kind === "embed") return `/tools/${t.key}`;
    return t.url ?? undefined;
  };

  const first = ctx.profile.full_name?.split(" ")[0] ?? "";

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 28px" }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>
        Willkommen{first ? `, ${first}` : ""} bei AWOS
      </h1>
      <p style={{ color: "var(--muted)", marginTop: 6 }}>
        Deine zentrale Plattform. Wähle ein Tool.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 14,
          marginTop: 28,
        }}
      >
        {tools.map((t) => {
          const href = hrefFor(t);
          const external = t.kind === "link";
          const maintenance = t.status === "maintenance";
          const badge = maintenance ? "Wartung" : !href ? "Bald" : null;
          const color = t.color ?? "#579bfc";

          const inner = (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    background: color + "22",
                    border: `1px solid ${color}55`,
                  }}
                >
                  {t.icon || t.name.slice(0, 2)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: 700,
                      fontSize: 16,
                    }}
                  >
                    {t.name}
                    {badge && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: 0.4,
                          color: maintenance ? "#fdab3d" : "var(--muted)",
                          background: "var(--surface-2)",
                          border: `1px solid ${maintenance ? "#fdab3d55" : "var(--border)"}`,
                          borderRadius: 999,
                          padding: "1px 7px",
                        }}
                      >
                        {badge}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <p
                style={{
                  color: "var(--muted)",
                  fontSize: 13,
                  margin: "12px 0 0",
                  minHeight: 34,
                }}
              >
                {t.description ?? ""}
              </p>
            </>
          );

          const baseCard: React.CSSProperties = {
            display: "block",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 18,
            textDecoration: "none",
            color: "var(--text)",
            opacity: href ? 1 : 0.6,
          };

          if (!href)
            return (
              <div key={t.key} style={{ ...baseCard, cursor: "default" }}>
                {inner}
              </div>
            );
          return (
            <a
              key={t.key}
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              style={baseCard}
            >
              {inner}
            </a>
          );
        })}
      </div>
    </div>
  );
}
