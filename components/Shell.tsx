"use client";

import { useState } from "react";
import type { SessionContext } from "@/lib/auth";
import type { Board } from "@/lib/types";
import AppHeader from "./AppHeader";
import NotificationBell from "./NotificationBell";
import Sidebar from "./Sidebar";

// App chrome: top bar + header + off-canvas-capable sidebar + main. The sidebar
// is a static column on desktop and a slide-in drawer (toggled by the header
// hamburger) on mobile.
export default function Shell({
  ctx,
  boards,
  children,
}: {
  ctx: SessionContext;
  boards: Board[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div
        style={{
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 16,
          padding: "0 18px",
          borderBottom: "1px solid var(--border)",
          background: "var(--topbar-bg)",
          flexShrink: 0,
        }}
      >
        <NotificationBell userId={ctx.userId} />
        {/* Agency logo (white). Drop the file at public/logo.png (or .svg);
            it hides itself if the asset is missing. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt=""
          style={{ height: 22, width: "auto", objectFit: "contain" }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </div>

      <AppHeader ctx={ctx} onMenuClick={() => setOpen(true)} />

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Sidebar boards={boards} open={open} onClose={() => setOpen(false)} />
        {open && <div className="app-scrim" onClick={() => setOpen(false)} />}
        <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>{children}</main>
      </div>
    </div>
  );
}
