"use client";

import { useEffect, useState } from "react";
import Icon from "./icons";

type Theme = "dark" | "light";

// Menu row that switches between dark and light, persisted in localStorage.
export default function ThemeToggle({ style }: { style?: React.CSSProperties }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const t = (localStorage.getItem("awos-theme") as Theme) || "dark";
    setTheme(t);
  }, []);

  const set = (t: Theme) => {
    setTheme(t);
    localStorage.setItem("awos-theme", t);
    document.documentElement.dataset.theme = t;
  };

  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      onClick={() => set(next)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        ...style,
      }}
    >
      <Icon name={theme === "dark" ? "sparkles" : "eye-off"} size={16} />
      {theme === "dark" ? "Heller Modus" : "Dunkler Modus"}
    </button>
  );
}
