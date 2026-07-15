import type { CSSProperties } from "react";

/** Darken a #rrggbb hex colour by `amt` (0–1). Returns input if unparseable. */
export function darken(hex: string, amt = 0.22): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.round(((n >> 16) & 255) * (1 - amt));
  const g = Math.round(((n >> 8) & 255) * (1 - amt));
  const b = Math.round((n & 255) * (1 - amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Rounded status pill with a subtle dark→light gradient of its colour. */
export function statusPillStyle(color: string): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: `linear-gradient(135deg, ${darken(color, 0.28)}, ${color})`,
    color: "#fff",
    borderRadius: 999,
    padding: "4px 12px",
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1.5,
    whiteSpace: "nowrap",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
  };
}

/** Placeholder pill for an empty status. */
export const emptyPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  color: "var(--faint)",
  border: "1px dashed var(--border)",
  borderRadius: 999,
  padding: "3px 12px",
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.5,
};

/** Red/amber urgency pill shown next to a near/overdue deadline. */
export function urgencyPillStyle(tone: "red" | "amber"): CSSProperties {
  const base = tone === "red" ? "#e2445c" : "#fdab3d";
  return {
    display: "inline-flex",
    alignItems: "center",
    background: `linear-gradient(135deg, ${darken(base, 0.28)}, ${base})`,
    color: "#fff",
    borderRadius: 999,
    padding: "2px 9px",
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1.5,
    whiteSpace: "nowrap",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
  };
}
