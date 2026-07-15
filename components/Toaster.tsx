"use client";

import { useEffect, useState } from "react";

type Item = { id: number; message: string };

// Listens for "awos-toast" events and shows brief, auto-dismissing toasts.
export default function Toaster() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let seq = 0;
    const onToast = (e: Event) => {
      const message = (e as CustomEvent<{ message: string }>).detail?.message;
      if (!message) return;
      const id = ++seq;
      setItems((prev) => [...prev, { id, message }]);
      setTimeout(
        () => setItems((prev) => prev.filter((t) => t.id !== id)),
        2600,
      );
    };
    window.addEventListener("awos-toast", onToast);
    return () => window.removeEventListener("awos-toast", onToast);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {items.map((t) => (
        <div
          key={t.id}
          style={{
            background: "var(--surface-2)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderLeft: "3px solid var(--ok)",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 14,
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            animation: "awos-toast-in 160ms ease",
            maxWidth: 320,
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
