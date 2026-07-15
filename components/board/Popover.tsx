"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

// Renders a popover into document.body (via portal) positioned under an anchor
// rect, so it escapes the table's overflow/clipping. Closes on outside click,
// scroll, or resize.
export default function Popover({
  rect,
  width = 280,
  align = "left",
  onClose,
  children,
}: {
  rect: DOMRect;
  width?: number;
  align?: "left" | "center";
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [onClose]);

  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  let left =
    align === "center" ? rect.left + rect.width / 2 - width / 2 : rect.left;
  left = Math.max(8, Math.min(left, vw - width - 8));
  // Open upward if there isn't room below.
  const openUp = rect.bottom + 320 > vh && rect.top > vh - rect.bottom;

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 1000 }}
      />
      <div
        style={{
          position: "fixed",
          left,
          width,
          maxHeight: "70vh",
          overflowY: "auto",
          zIndex: 1001,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          boxShadow: "var(--shadow)",
          ...(openUp
            ? { bottom: vh - rect.top + 4 }
            : { top: rect.bottom + 4 }),
        }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
