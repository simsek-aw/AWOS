"use client";

import { type ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/icons";
import type { Tool } from "@/lib/types";

type FavBoard = { id: string; name: string; type: string };

// Desktop-only left navigation: Home + AW tools + favorites + settings/admin.
// Collapsible to an icon-only rail (persisted). Hidden on mobile (the top
// switcher covers that). Board pages use the board sidebar instead.
export default function ToolNav({
  tools,
  favorites = [],
  isAdmin = false,
}: {
  tools: Tool[];
  favorites?: FavBoard[];
  isAdmin?: boolean;
}) {
  const pathname = usePathname() ?? "/";
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("awos-toolnav-collapsed") === "1");
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("awos-toolnav-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const hrefFor = (t: Tool): string | undefined => {
    if (t.status === "maintenance" || !t.enabled) return undefined;
    if (t.kind === "internal") return t.url ?? "/";
    if (t.kind === "embed") return `/tools/${t.key}`;
    return t.url ?? undefined;
  };
  const external = (t: Tool) => t.kind === "link";
  const isToolActive = (t: Tool) => {
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
        width: collapsed ? 60 : 220,
        flexShrink: 0,
        borderRight: "1px solid var(--border)",
        background: "var(--sidebar-bg)",
        padding: collapsed ? "12px 8px" : "12px 10px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        transition: "width 160ms ease",
      }}
    >
      {/* Collapse toggle */}
      <button
        type="button"
        onClick={toggle}
        title={collapsed ? "Menü ausklappen" : "Menü einklappen"}
        aria-label={collapsed ? "Menü ausklappen" : "Menü einklappen"}
        style={{
          alignSelf: collapsed ? "center" : "flex-end",
          background: "transparent",
          border: "none",
          color: "var(--muted)",
          cursor: "pointer",
          padding: 6,
          borderRadius: 8,
          marginBottom: 4,
          display: "inline-flex",
        }}
      >
        <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={16} />
      </button>

      <div style={{ flex: 1 }}>
        <NavItem
          href="/"
          leading={<Icon name="grid" size={16} />}
          label="Home"
          active={pathname === "/"}
          collapsed={collapsed}
        />

        <Divider />
        <GroupLabel collapsed={collapsed}>Tools</GroupLabel>
        {available.map((t) => (
          <NavItem
            key={t.key}
            href={hrefFor(t)!}
            targetBlank={external(t)}
            leading={<Emoji>{t.icon || t.name.slice(0, 1)}</Emoji>}
            label={t.name}
            active={isToolActive(t)}
            collapsed={collapsed}
            trailing={
              external(t) ? (
                <Icon name="external" size={12} style={{ opacity: 0.6, flexShrink: 0 }} />
              ) : undefined
            }
          />
        ))}
        {!collapsed &&
          soon.map((t) => (
            <NavItem
              key={t.key}
              leading={<Emoji>{t.icon || t.name.slice(0, 1)}</Emoji>}
              label={t.name}
              collapsed={collapsed}
              disabled
              trailing={
                <span style={soonBadge(t.status === "maintenance")}>
                  {t.status === "maintenance" ? "Wartung" : "Bald"}
                </span>
              }
            />
          ))}

        {favorites.length > 0 && (
          <>
            <Divider />
            <GroupLabel collapsed={collapsed}>Favoriten</GroupLabel>
            {favorites.map((b) => (
              <NavItem
                key={b.id}
                href={`/boards/${b.id}`}
                leading={<Dot type={b.type} name={b.name} />}
                label={b.name}
                active={pathname.startsWith(`/boards/${b.id}`)}
                collapsed={collapsed}
              />
            ))}
          </>
        )}
      </div>

      {/* Bottom: settings + admin */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 6, marginTop: 6 }}>
        <NavItem
          href="/profile"
          leading={<Icon name="user" size={16} />}
          label="Einstellungen"
          active={pathname === "/profile"}
          collapsed={collapsed}
        />
        {isAdmin && (
          <NavItem
            href="/admin"
            leading={<Icon name="shield" size={16} />}
            label="Admin"
            active={pathname.startsWith("/admin")}
            collapsed={collapsed}
          />
        )}
      </div>
    </aside>
  );
}

function NavItem({
  href,
  targetBlank,
  leading,
  label,
  active = false,
  disabled = false,
  collapsed = false,
  trailing,
}: {
  href?: string;
  targetBlank?: boolean;
  leading: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  collapsed?: boolean;
  trailing?: ReactNode;
}) {
  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: collapsed ? 0 : 10,
    justifyContent: collapsed ? "center" : "flex-start",
    padding: collapsed ? "9px 0" : "8px 10px",
    borderRadius: 8,
    textDecoration: "none",
    color: active ? "var(--accent)" : "var(--muted)",
    background: active ? "var(--active)" : undefined,
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    marginBottom: 2,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
  const inner = (
    <>
      <span style={{ display: "inline-flex", flexShrink: 0 }}>{leading}</span>
      {!collapsed && (
        <>
          <span style={navName}>{label}</span>
          {trailing}
        </>
      )}
    </>
  );
  if (disabled || !href) {
    return (
      <div className="nav-item" style={style} title={collapsed ? label : undefined}>
        {inner}
      </div>
    );
  }
  return (
    <a
      href={href}
      target={targetBlank ? "_blank" : undefined}
      rel={targetBlank ? "noopener noreferrer" : undefined}
      className="nav-item"
      style={style}
      title={collapsed ? label : undefined}
    >
      {inner}
    </a>
  );
}

function Emoji({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontSize: 15, width: 18, textAlign: "center" }}>{children}</span>
  );
}

function Dot({ type, name }: { type: string; name: string }) {
  const color = type === "internal" ? "#fdab3d" : "#00c875";
  return (
    <span
      aria-hidden
      style={{
        width: 18,
        height: 18,
        borderRadius: 6,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        fontWeight: 700,
        color: "#0b0b0b",
        background: color,
      }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--border)", margin: "10px 6px 2px" }} />;
}

function GroupLabel({
  children,
  collapsed,
}: {
  children: ReactNode;
  collapsed: boolean;
}) {
  if (collapsed) return <div style={{ height: 8 }} />;
  return (
    <div
      style={{
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        color: "var(--faint)",
        fontWeight: 700,
        padding: "14px 8px 6px",
      }}
    >
      {children}
    </div>
  );
}

const navName: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function soonBadge(maintenance: boolean): React.CSSProperties {
  return {
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
  };
}
