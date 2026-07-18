"use client";

import { useEffect, useState } from "react";

// Tabbed container for the admin sections. Content is server-rendered and passed
// in as nodes; this only handles which tab is visible. The active tab is
// remembered (localStorage) so it survives the redirects that admin actions do.
export default function AdminTabs({
  tabs,
  defaultKey,
}: {
  tabs: { key: string; label: string; content: React.ReactNode }[];
  defaultKey?: string;
}) {
  const [active, setActive] = useState(defaultKey ?? tabs[0]?.key ?? "");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("awos-admin-tab");
      if (saved && tabs.some((t) => t.key === saved)) setActive(saved);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (k: string) => {
    setActive(k);
    try {
      localStorage.setItem("awos-admin-tab", k);
    } catch {
      /* ignore */
    }
  };

  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div style={{ marginTop: 20 }}>
      <div
        role="tablist"
        className="tab-scroll"
        style={{
          gap: 4,
          borderBottom: "1px solid var(--border)",
          marginBottom: 20,
        }}
      >
        {tabs.map((t) => {
          const on = t.key === current?.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={on}
              onClick={() => select(t.key)}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: `2px solid ${on ? "var(--accent)" : "transparent"}`,
                color: on ? "var(--text)" : "var(--muted)",
                fontSize: 14,
                fontWeight: 600,
                padding: "8px 12px",
                marginBottom: -1,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div>{current?.content}</div>
    </div>
  );
}
