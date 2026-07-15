"use client";

import { useState } from "react";
import type { SessionContext } from "@/lib/auth";
import type { Board } from "@/lib/types";
import AppHeader from "./AppHeader";
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
      <AppHeader ctx={ctx} onMenuClick={() => setOpen(true)} />

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Sidebar boards={boards} open={open} onClose={() => setOpen(false)} />
        {open && <div className="app-scrim" onClick={() => setOpen(false)} />}
        <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>{children}</main>
      </div>
    </div>
  );
}
