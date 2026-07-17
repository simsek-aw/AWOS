"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listDeletedTasks,
  purgeTask,
  restoreTask,
} from "@/app/(app)/boards/[id]/actions";
import { toast } from "@/components/toast";

type Trashed = { id: string; title: string; deletedAt: string };

export default function BoardTrash({ boardId }: { boardId: string }) {
  const [items, setItems] = useState<Trashed[] | null>(null);
  const router = useRouter();

  useEffect(() => {
    listDeletedTasks(boardId)
      .then(setItems)
      .catch(() => setItems([]));
  }, [boardId]);

  const restore = async (id: string) => {
    setItems((p) => p?.filter((x) => x.id !== id) ?? null);
    await restoreTask(boardId, id);
    toast("Task wiederhergestellt");
    router.refresh();
  };
  const purge = async (id: string) => {
    if (!confirm("Task endgültig löschen? Das kann nicht rückgängig gemacht werden."))
      return;
    setItems((p) => p?.filter((x) => x.id !== id) ?? null);
    await purgeTask(boardId, id);
    toast("Endgültig gelöscht");
  };

  return (
    <div style={{ padding: 10, minWidth: 240 }}>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          color: "var(--faint)",
          fontWeight: 700,
          padding: "2px 4px 8px",
        }}
      >
        Papierkorb
      </div>
      {items === null && (
        <p style={{ color: "var(--faint)", fontSize: 13, padding: 4 }}>Lädt …</p>
      )}
      {items && items.length === 0 && (
        <p style={{ color: "var(--faint)", fontSize: 13, padding: 4 }}>
          Nichts im Papierkorb.
        </p>
      )}
      <div style={{ display: "grid", gap: 4, maxHeight: 320, overflowY: "auto" }}>
        {items?.map((t) => (
          <div
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 4px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 13,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={t.title}
            >
              {t.title}
            </span>
            <button
              onClick={() => restore(t.id)}
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "3px 8px",
                color: "var(--accent)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Wiederherstellen
            </button>
            <button
              onClick={() => purge(t.id)}
              title="Endgültig löschen"
              aria-label="Endgültig löschen"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--danger)",
                cursor: "pointer",
                fontSize: 15,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
