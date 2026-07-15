"use client";

import type { SessionContext } from "@/lib/auth";

const roleLabel: Record<string, string> = {
  employee: "Mitarbeiter",
  customer: "Kunde",
};

export default function AppHeader({
  ctx,
  onMenuClick,
}: {
  ctx: SessionContext;
  onMenuClick?: () => void;
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 24px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {onMenuClick && (
          <button
            className="app-hamburger"
            onClick={onMenuClick}
            title="Menü"
            aria-label="Menü öffnen"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text)",
              cursor: "pointer",
              fontSize: 20,
              lineHeight: 1,
              padding: 0,
              alignItems: "center",
            }}
          >
            ☰
          </button>
        )}
        <a
          href="/"
          style={{ fontWeight: 700, fontSize: 18, color: "var(--text)", textDecoration: "none" }}
        >
          AWOS
        </a>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {ctx.profile.role === "employee" && (
          <a href="/admin" style={{ color: "var(--muted)", fontSize: 14 }}>
            Admin
          </a>
        )}
        <span className="app-user-meta" style={{ color: "var(--muted)", fontSize: 14 }}>
          {ctx.profile.full_name ?? ctx.email} ·{" "}
          {roleLabel[ctx.profile.role] ?? ctx.profile.role}
        </span>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--muted)",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Abmelden
          </button>
        </form>
      </div>
    </header>
  );
}
