"use client";

import { usePathname } from "next/navigation";
import Icon from "@/components/icons";
import type { Tool } from "@/lib/types";

// Desktop-only left navigation listing the AW tools (the product switcher, as a
// persistent rail). Shown on the platform home and tool pages — board pages use
// the board sidebar instead. Hidden on mobile (the top switcher covers that).
export default function ToolNav({ tools }: { tools: Tool[] }) {
  const pathname = usePathname() ?? "/";

  const hrefFor = (t: Tool): string | undefined => {
    if (t.status === "maintenance" || !t.enabled) return undefined;
    if (t.kind === "internal") return t.url ?? "/";
    if (t.kind === "embed") return `/tools/${t.key}`;
    return t.url ?? undefined;
  };
  const external = (t: Tool) => t.kind === "link";
  const isActive = (t: Tool) => {
    const url = hrefFor(t);
    if (!url || url === "/") return false;
    return pathname === url || pathname.startsWith(url + "/");
  };

  const available = tools.filter((t) => !!hrefFor(t) && t.status !== "maintenance");
  const soon = tools.filter((t) => !hrefFor(t) || t.status === "maintenance");

  return (
    <aside
      className="tool-nav"
      style={{
        width: 220,
        flexShrink: 0,
        borderRight: "1px solid var(--border)",
        background: "var(--sidebar-bg)",
        padding: "16px 10px",
        overflowY: "auto",
      }}
    >
      <a href="/" onClick={undefined} className="nav-item" style={navLink(pathname === "/")}>
        <Icon name="grid" size={16} />
        Home
      </a>

      <div style={{ height: 1, background: "var(--border)", margin: "10px 6px 2px" }} />

      <div style={groupLabel}>Tools</div>
      {available.map((t) => {
        const href = hrefFor(t)!;
        const active = isActive(t);
        return (
          <a
            key={t.key}
            href={href}
            target={external(t) ? "_blank" : undefined}
            rel={external(t) ? "noopener noreferrer" : undefined}
            className="nav-item"
            style={navLink(active)}
          >
            <span style={{ fontSize: 15, width: 18, textAlign: "center", flexShrink: 0 }}>
              {t.icon || t.name.slice(0, 1)}
            </span>
            <span style={navName}>{t.name}</span>
            {external(t) && (
              <Icon name="external" size={12} style={{ opacity: 0.6, flexShrink: 0 }} />
            )}
          </a>
        );
      })}

      {soon.length > 0 && (
        <>
          <div style={groupLabel}>Bald verfügbar</div>
          {soon.map((t) => {
            const maintenance = t.status === "maintenance";
            return (
              <div
                key={t.key}
                title="Noch nicht verknüpft"
                style={{ ...navLink(false), cursor: "default", opacity: 0.55 }}
              >
                <span style={{ fontSize: 15, width: 18, textAlign: "center", flexShrink: 0 }}>
                  {t.icon || t.name.slice(0, 1)}
                </span>
                <span style={navName}>{t.name}</span>
                <span
                  style={{
                    marginLeft: "auto",
                    flexShrink: 0,
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                    color: maintenance ? "#fdab3d" : "var(--faint)",
                    border: `1px solid ${maintenance ? "#fdab3d55" : "var(--border)"}`,
                    borderRadius: 999,
                    padding: "1px 6px",
                  }}
                >
                  {maintenance ? "Wartung" : "Bald"}
                </span>
              </div>
            );
          })}
        </>
      )}
    </aside>
  );
}

function navLink(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 8,
    textDecoration: "none",
    color: active ? "var(--accent)" : "var(--muted)",
    background: active ? "var(--active)" : undefined,
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    marginBottom: 2,
  };
}
const navName: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const groupLabel: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  color: "var(--faint)",
  fontWeight: 700,
  padding: "14px 8px 6px",
};
