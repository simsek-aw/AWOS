"use client";

import { useEffect } from "react";

// Records a board visit in localStorage so the dashboard can show a
// "Zuletzt besucht" section. Purely client-side (per browser), no DB.
export default function RecentBoardTracker({
  id,
  name,
  type,
}: {
  id: string;
  name: string;
  type: string;
}) {
  useEffect(() => {
    try {
      const raw = localStorage.getItem("awos-board-recents");
      const prev = raw
        ? (JSON.parse(raw) as { id: string; name: string; type: string }[])
        : [];
      const next = [
        { id, name, type },
        ...prev.filter((r) => r.id !== id),
      ].slice(0, 10);
      localStorage.setItem("awos-board-recents", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, [id, name, type]);

  return null;
}
