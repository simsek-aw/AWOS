"use client";

import { useEffect, useState } from "react";
import type { SessionContext } from "@/lib/auth";
import { CURRENT_TOOL_KEY, type Tool } from "@/lib/types";
import GlobalSearch from "./GlobalSearch";
import Icon from "./icons";
import NotificationBell from "./NotificationBell";
import ProductSwitcher from "./ProductSwitcher";
import UserMenu from "./UserMenu";

export default function AppHeader({
  ctx,
  tools = [],
  onMenuClick,
}: {
  ctx: SessionContext;
  tools?: Tool[];
  onMenuClick?: () => void;
}) {
  const admin = ctx.profile.is_admin ?? ctx.profile.role === "employee";
  const [searchOpen, setSearchOpen] = useState(false);

  // Cmd/Ctrl+K opens the search overlay from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
        {tools.length > 0 && (
          <ProductSwitcher tools={tools} currentKey={CURRENT_TOOL_KEY} />
        )}
      </div>

      {/* Middle: global search (full bar on desktop) */}
      <div
        className="header-search"
        style={{ flex: 1, display: "flex", justifyContent: "center", minWidth: 0 }}
      >
        <GlobalSearch />
      </div>
      {/* Mobile: spacer so the right group stays right */}
      <div className="header-search-btn" style={{ flex: 1 }} />

      {/* Right: search (mobile) · notifications · (admin) · user */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
        <button
          className="header-search-btn"
          onClick={() => setSearchOpen(true)}
          title="Suchen"
          aria-label="Suchen"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text)",
            cursor: "pointer",
            padding: 0,
            alignItems: "center",
          }}
        >
          <Icon name="search" size={20} />
        </button>
        <NotificationBell userId={ctx.userId} />
        {admin && (
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

      {/* Mobile search overlay */}
      {searchOpen && (
        <div
          onClick={() => setSearchOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(0,0,0,0.5)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: 12,
              background: "var(--topbar-bg)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <GlobalSearch autoFocus />
            </div>
            <button
              onClick={() => setSearchOpen(false)}
              title="Schließen"
              aria-label="Schließen"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                padding: 4,
              }}
            >
              <Icon name="x" size={20} />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
