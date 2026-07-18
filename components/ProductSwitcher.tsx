"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/icons";
import type { Tool } from "@/lib/types";

// The apps-launcher next to the logo: ties AWOS's separate tools together
// (AWcms, AWscribe, AWstudio, …). Click opens a grid; each tile links to the
// tool (internal route, external tab, or embedded viewer).
export default function ProductSwitcher({
  tools,
  currentKey,
}: {
  tools: Tool[];
  currentKey: string;
}) {
  const [open, setOpen] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Cmd/Ctrl+. toggles the switcher from anywhere; load recents when opening.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem("awos-tool-recents");
      setRecents(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setRecents([]);
    }
  }, [open]);

  const recordRecent = (key: string) => {
    try {
      const raw = localStorage.getItem("awos-tool-recents");
      const prev = raw ? (JSON.parse(raw) as string[]) : [];
      const next = [key, ...prev.filter((k) => k !== key)].slice(0, 5);
      localStorage.setItem("awos-tool-recents", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const current = tools.find((t) => t.key === currentKey);

  const hrefFor = (t: Tool): string | undefined => {
    if (!t.enabled && t.key !== currentKey) return undefined;
    if (t.kind === "internal") return t.url ?? "/";
    if (t.kind === "embed") return `/tools/${t.key}`;
    return t.url ?? undefined; // link
  };
  const external = (t: Tool) => t.kind === "link";

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Tools wechseln (⌘/Strg + .)"
        aria-label="Tools wechseln"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: open ? "var(--active)" : "transparent",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "5px 8px",
          color: "var(--text)",
          cursor: "pointer",
        }}
      >
        <Icon name="grid" size={16} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {current?.name ?? "Tools"}
        </span>
        <Icon name="chevron-down" size={13} style={{ opacity: 0.7 }} />
      </button>

      {open && (
        <div
          className="product-switcher-panel pop-in"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 90,
            width: 460,
            maxWidth: "calc(100vw - 32px)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "var(--shadow)",
            padding: 10,
          }}
        >
          {(() => {
            const recentTools = recents
              .map((k) => tools.find((t) => t.key === k))
              .filter((t): t is Tool => !!t && !!hrefFor(t))
              .slice(0, 3);
            if (!recentTools.length) return null;
            return (
              <div style={{ padding: "2px 6px 8px" }}>
                <div
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    color: "var(--faint)",
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  Zuletzt
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {recentTools.map((t) => (
                    <a
                      key={t.key}
                      href={hrefFor(t)}
                      target={external(t) ? "_blank" : undefined}
                      rel={external(t) ? "noopener noreferrer" : undefined}
                      onClick={() => {
                        recordRecent(t.key);
                        setOpen(false);
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 10px 4px 6px",
                        borderRadius: 999,
                        border: "1px solid var(--border)",
                        background: "var(--surface-2)",
                        textDecoration: "none",
                        color: "var(--text)",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ fontSize: 14 }}>
                        {t.icon || t.name.slice(0, 1)}
                      </span>
                      {t.name}
                    </a>
                  ))}
                </div>
              </div>
            );
          })()}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 6px 8px",
            }}
          >
            <span
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                color: "var(--faint)",
                fontWeight: 700,
              }}
            >
              AWOS · Tools
            </span>
            <button
              className="product-switcher-close"
              onClick={() => setOpen(false)}
              aria-label="Schließen"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
                padding: 4,
              }}
            >
              <Icon name="x" size={20} />
            </button>
          </div>
          <div
            className="switcher-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
            }}
          >
            {tools.map((t) => {
              const href = hrefFor(t);
              const isCurrent = t.key === currentKey;
              const maintenance = t.status === "maintenance";
              const disabled = !href || maintenance;
              const badge = maintenance
                ? "Wartung"
                : !href
                  ? "Bald"
                  : null;
              const tile = (
                <>
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      flexShrink: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      background: (t.color ?? "#579bfc") + "22",
                      border: `1px solid ${(t.color ?? "#579bfc") + "55"}`,
                    }}
                  >
                    {t.icon || t.name.slice(0, 2)}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text)",
                      }}
                    >
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t.name}
                      </span>
                      {external(t) && !disabled && (
                        <Icon name="external" size={11} style={{ opacity: 0.6 }} />
                      )}
                      {badge && (
                        <span
                          style={{
                            flexShrink: 0,
                            fontSize: 9,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: 0.4,
                            color: maintenance ? "#fdab3d" : "var(--muted)",
                            background: "var(--surface-2)",
                            border: `1px solid ${maintenance ? "#fdab3d55" : "var(--border)"}`,
                            borderRadius: 999,
                            padding: "1px 6px",
                          }}
                        >
                          {badge}
                        </span>
                      )}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 11,
                        color: "var(--muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.description || ""}
                    </span>
                  </span>
                </>
              );
              const baseStyle: React.CSSProperties = {
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 8,
                borderRadius: 10,
                textDecoration: "none",
                border: `1px solid ${isCurrent ? "var(--accent)" : "transparent"}`,
                background: isCurrent ? "var(--active)" : "transparent",
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.55 : 1,
                // Let the tile shrink to its grid column so long descriptions
                // truncate instead of overflowing the panel.
                minWidth: 0,
                overflow: "hidden",
              };
              if (disabled) {
                return (
                  <div key={t.key} style={baseStyle} title="Noch nicht verknüpft">
                    {tile}
                  </div>
                );
              }
              return (
                <a
                  key={t.key}
                  href={href}
                  target={external(t) ? "_blank" : undefined}
                  rel={external(t) ? "noopener noreferrer" : undefined}
                  onClick={() => {
                    recordRecent(t.key);
                    setOpen(false);
                  }}
                  style={baseStyle}
                  onMouseEnter={(e) => {
                    if (!isCurrent)
                      e.currentTarget.style.background = "var(--surface-2)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrent)
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  {tile}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
