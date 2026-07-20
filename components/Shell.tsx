"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { SessionContext } from "@/lib/auth";
import type { Board, Tool } from "@/lib/types";
import AppHeader from "./AppHeader";
import Sidebar from "./Sidebar";
import Toaster from "./Toaster";
import ToolNav from "./ToolNav";

// App chrome: top bar + header + off-canvas-capable sidebar + main. The sidebar
// is a static column on desktop and a slide-in drawer (toggled by the header
// hamburger) on mobile.
export default function Shell({
  ctx,
  boards,
  unreadByBoard = {},
  favoriteIds = [],
  tools = [],
  children,
}: {
  ctx: SessionContext;
  boards: Board[];
  unreadByBoard?: Record<string, number>;
  favoriteIds?: string[];
  tools?: Tool[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // The board sidebar belongs to AWcms only. Customers live entirely in the
  // CMS, so they always get it; employees see it only on CMS routes (boards /
  // my tasks / people / notifications) — not on the platform home or other tools.
  const isCustomer = ctx.profile.role !== "employee";
  const cmsRoute = /^\/(boards|my|people|notifications)(\/|$)/.test(
    pathname ?? "",
  );
  const showSidebar = isCustomer || cmsRoute;
  // Employees on non-board routes (dashboard, tool pages) get the tools rail as
  // their left navigation instead of the board sidebar. Desktop-only.
  const showToolNav = !isCustomer && !cmsRoute && tools.length > 0;

  // Apply the saved theme (dark default) on load.
  useEffect(() => {
    const t = localStorage.getItem("awos-theme");
    if (t === "light" || t === "dark" || t === "aw")
      document.documentElement.dataset.theme = t;
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <AppHeader
        ctx={ctx}
        tools={tools}
        onMenuClick={showSidebar ? () => setOpen(true) : undefined}
        toolNavVisible={showToolNav}
      />

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {showSidebar && (
          <Sidebar
            boards={boards}
            unreadByBoard={unreadByBoard}
            favoriteIds={favoriteIds}
            isEmployee={ctx.profile.role === "employee"}
            open={open}
            onClose={() => setOpen(false)}
          />
        )}
        {showSidebar && open && (
          <div className="app-scrim" onClick={() => setOpen(false)} />
        )}
        {showToolNav && <ToolNav tools={tools} />}
        <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
