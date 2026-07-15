"use client";

import type { SessionContext } from "@/lib/auth";
import Icon from "./icons";

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
            <Icon name="menu" size={22} />
          </button>
        )}
        <a href="/" style={{ display: "inline-flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="AWOS"
            style={{ height: 24, width: "auto", objectFit: "contain" }}
            onError={(e) => {
              // Fall back to the wordmark if the logo asset is missing.
              const img = e.currentTarget as HTMLImageElement;
              img.style.display = "none";
              const w = img.nextElementSibling as HTMLElement | null;
              if (w) w.style.display = "inline";
            }}
          />
          <span
            style={{
              display: "none",
              fontWeight: 700,
              fontSize: 18,
              color: "var(--text)",
            }}
          >
            AWOS
          </span>
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
