"use client";

import { useEffect, useState } from "react";
import type { SessionContext } from "@/lib/auth";
import type { Board, Tool } from "@/lib/types";
import AppHeader from "./AppHeader";
import Sidebar from "./Sidebar";
import Toaster from "./Toaster";

// App chrome: top bar + header + off-canvas-capable sidebar + main. The sidebar
// is a static column on desktop and a slide-in drawer (toggled by the header
// hamburger) on mobile.
export default function Shell({
  ctx,
  boards,
  unreadByBoard = {},
  tools = [],
  children,
}: {
  ctx: SessionContext;
  boards: Board[];
  unreadByBoard?: Record<string, number>;
  tools?: Tool[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // Apply the saved theme (dark default) on load.
  useEffect(() => {
    const t = localStorage.getItem("awos-theme");
    if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <AppHeader ctx={ctx} tools={tools} onMenuClick={() => setOpen(true)} />

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Sidebar
          boards={boards}
          unreadByBoard={unreadByBoard}
          isEmployee={ctx.profile.role === "employee"}
          open={open}
          onClose={() => setOpen(false)}
        />
        {open && <div className="app-scrim" onClick={() => setOpen(false)} />}
        <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
