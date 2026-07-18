"use client";

import { useEffect, useRef, useState } from "react";
import type { SessionContext } from "@/lib/auth";
import Icon from "./icons";
import ThemeToggle from "./ThemeToggle";

const roleLabel: Record<string, string> = {
  employee: "Mitarbeiter",
  customer: "Kunde",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function UserMenu({ ctx }: { ctx: SessionContext }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const name = ctx.profile.full_name ?? ctx.email ?? "Benutzer";
  const role = roleLabel[ctx.profile.role] ?? ctx.profile.role;
  const isEmployee = ctx.profile.role === "employee";
  const admin = ctx.profile.is_admin ?? isEmployee;

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={name}
        aria-label="Benutzermenü"
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: isEmployee ? "var(--accent)" : "var(--surface-2)",
          color: "#fff",
          border: "1px solid var(--border)",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 700,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
      >
        {initials(name)}
      </button>

      {open && (
        <div
          className="pop-in"
          style={{
            position: "absolute",
            right: 0,
            top: "140%",
            width: 240,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            zIndex: 60,
            overflow: "hidden",
            boxShadow: "0 14px 40px rgba(0,0,0,0.55)",
            transformOrigin: "top right",
          }}
        >
          {/* Identity */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: isEmployee ? "var(--accent)" : "var(--surface-2)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {initials(name)}
            </span>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {name}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{role}</div>
            </div>
          </div>

          <a href="/profile" style={menuItem}>
            <Icon name="user" size={16} />
            Einstellungen
          </a>
          {admin && (
            <a href="/admin" style={menuItem}>
              <Icon name="shield" size={16} />
              Admin
            </a>
          )}
          <a href="/my" style={menuItem}>
            <Icon name="check" size={16} />
            Meine Aufgaben
          </a>

          <div style={{ borderTop: "1px solid var(--border)" }}>
            <ThemeToggle style={{ ...menuItem }} />
          </div>

          <form action="/auth/signout" method="post" style={{ margin: 0 }}>
            <button type="submit" style={{ ...menuItem, width: "100%", background: "transparent", cursor: "pointer" }}>
              <Icon name="logout" size={16} />
              Abmelden
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const menuItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text)",
  textDecoration: "none",
  border: "none",
  textAlign: "left",
};
