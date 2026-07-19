import type { CSSProperties, ReactNode } from "react";

// Shared board-shortcut chip styling (Favoriten / Zuletzt besucht), so both
// sections render identical compact rows inside their section cards.
export const boardChipGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
  gap: 8,
};
export const boardChipName: CSSProperties = {
  fontWeight: 600,
  fontSize: 14,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
export function boardChipStyle(type: string): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "var(--surface-2)",
    borderLeft: `3px solid ${type === "internal" ? "#fdab3d" : "#00c875"}`,
    borderRadius: 10,
    padding: "10px 12px",
    textDecoration: "none",
    color: "var(--text)",
  };
}

// Shared section container so every block on a page reads the same: a panel card
// with a consistent header (optional icon + title + optional right-aligned
// action) and body. Pure presentational — usable from server components.
export function SectionCard({
  title,
  icon,
  action,
  children,
  bodyGap = 8,
  style,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  bodyGap?: number;
  style?: React.CSSProperties;
}) {
  return (
    <section
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 16,
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {icon && (
            <span style={{ color: "var(--muted)", display: "inline-flex", flexShrink: 0 }}>
              {icon}
            </span>
          )}
          <h2 style={{ fontSize: 15, margin: 0 }}>{title}</h2>
        </div>
        {action}
      </div>
      <div style={{ display: "grid", gap: bodyGap }}>{children}</div>
    </section>
  );
}
