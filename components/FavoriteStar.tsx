"use client";

import { useEffect, useState, useTransition } from "react";
import { toggleBoardFavorite } from "@/app/(app)/boards/favorites";
import Icon from "@/components/icons";

// Standalone star toggle for a board (used in the board header). Optimistic +
// persisted via the server action.
export default function FavoriteStar({
  boardId,
  initial,
  size = 22,
}: {
  boardId: string;
  initial: boolean;
  size?: number;
}) {
  const [fav, setFav] = useState(initial);
  const [, startTransition] = useTransition();
  useEffect(() => setFav(initial), [initial]);

  const toggle = () => {
    const next = !fav;
    setFav(next);
    startTransition(() => {
      toggleBoardFavorite(boardId, next);
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={fav ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
      aria-label={fav ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
      aria-pressed={fav}
      className="glow-hover"
      style={{
        background: "transparent",
        border: "none",
        padding: 4,
        cursor: "pointer",
        display: "inline-flex",
        color: fav ? "#f5b301" : "var(--faint)",
        borderRadius: 8,
      }}
    >
      <Icon name="star" size={size} filled={fav} />
    </button>
  );
}
