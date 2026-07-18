import type { ReactNode } from "react";

// Friendly empty states with a light line-art illustration. Pure presentational
// (no hooks) so both server and client components can use it. The SVG uses
// currentColor and inherits a faint tone, so it adapts to light/dark themes.
type Variant = "tasks" | "activity" | "board" | "search" | "inbox";

const ART: Record<Variant, ReactNode> = {
  tasks: (
    <>
      <rect x="14" y="10" width="36" height="46" rx="4" />
      <path d="M24 10v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" />
      <path d="M22 26l4 4 8-8" />
      <path d="M22 42l4 4 8-8" />
    </>
  ),
  activity: (
    <>
      <path d="M6 34h10l5-14 8 26 6-18 4 6h19" />
    </>
  ),
  board: (
    <>
      <rect x="8" y="12" width="14" height="40" rx="3" />
      <rect x="26" y="12" width="14" height="26" rx="3" />
      <rect x="44" y="12" width="14" height="34" rx="3" />
    </>
  ),
  search: (
    <>
      <circle cx="28" cy="28" r="16" />
      <path d="M40 40l14 14" />
    </>
  ),
  inbox: (
    <>
      <path d="M8 34l8-22h32l8 22" />
      <path d="M8 34v16a2 2 0 0 0 2 2h44a2 2 0 0 0 2-2V34" />
      <path d="M8 34h14l4 6h12l4-6h14" />
    </>
  ),
};

export default function EmptyState({
  variant = "inbox",
  title,
  hint,
  action,
  compact = false,
}: {
  variant?: Variant;
  title: string;
  hint?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 4,
        padding: compact ? "24px 16px" : "40px 20px",
        color: "var(--muted)",
      }}
    >
      <svg
        width={compact ? 48 : 64}
        height={compact ? 48 : 64}
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: "var(--faint)", opacity: 0.7, marginBottom: 8 }}
        aria-hidden
      >
        {ART[variant]}
      </svg>
      <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 15 }}>
        {title}
      </div>
      {hint && (
        <div style={{ fontSize: 13, color: "var(--muted)", maxWidth: 340 }}>
          {hint}
        </div>
      )}
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>
  );
}
