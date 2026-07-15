"use client";

import type { SessionContext } from "@/lib/auth";
import GlobalSearch from "./GlobalSearch";
import Icon from "./icons";
import NotificationBell from "./NotificationBell";
import UserMenu from "./UserMenu";

export default function AppHeader({
  ctx,
  onMenuClick,
}: {
  ctx: SessionContext;
  onMenuClick?: () => void;
}) {
  const isEmployee = ctx.profile.role === "employee";

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "10px 20px",
        borderBottom: "1px solid var(--border)",
        background: "var(--topbar-bg)",
      }}
    >
      {/* Left: hamburger (mobile) + logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
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

      {/* Middle: global search */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center", minWidth: 0 }}>
        <GlobalSearch />
      </div>

      {/* Right: notifications · (admin) · user */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
        <NotificationBell userId={ctx.userId} />
        {isEmployee && (
          <a
            href="/admin"
            title="Admin"
            aria-label="Admin"
            className="header-admin"
            style={{
              color: "var(--muted)",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <Icon name="shield" size={18} />
          </a>
        )}
        <UserMenu ctx={ctx} />
      </div>
    </header>
  );
}
