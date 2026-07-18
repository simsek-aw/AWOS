"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "aw";

const OPTIONS: { key: Theme; label: string }[] = [
  { key: "light", label: "Hell" },
  { key: "dark", label: "Dunkel" },
  { key: "aw", label: "AW Style" },
];

// Segmented control that switches between Hell / Dunkel / AW Style, persisted
// in localStorage and applied via data-theme on <html>.
export default function ThemeToggle({ style }: { style?: React.CSSProperties }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const t = localStorage.getItem("awos-theme") as Theme | null;
    if (t === "light" || t === "dark" || t === "aw") setTheme(t);
  }, []);

  const set = (t: Theme) => {
    setTheme(t);
    localStorage.setItem("awos-theme", t);
    document.documentElement.dataset.theme = t;
  };

  return (
    <div style={{ ...style, display: "block" }}>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "var(--faint)",
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        Design
      </div>
      <div
        style={{
          display: "flex",
          gap: 3,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 3,
        }}
      >
        {OPTIONS.map((o) => {
          const on = theme === o.key;
          return (
            <button
              key={o.key}
              onClick={() => set(o.key)}
              aria-pressed={on}
              style={{
                flex: 1,
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 4px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
                background: on ? "var(--accent)" : "transparent",
                color: on ? "#fff" : "var(--muted)",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
