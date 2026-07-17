"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  applyTemplate,
  createTemplate,
  deleteTemplate,
  listTemplates,
  type TaskTemplate,
} from "@/app/(app)/boards/[id]/actions";
import { toast } from "@/components/toast";

const recLabel: Record<string, string> = {
  none: "",
  weekly: "wöchentlich",
  monthly: "monatlich",
};

export default function BoardTemplates({ boardId }: { boardId: string }) {
  const [items, setItems] = useState<TaskTemplate[] | null>(null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [recurrence, setRecurrence] = useState("none");
  const router = useRouter();

  const reload = () =>
    listTemplates(boardId)
      .then(setItems)
      .catch(() => setItems([]));
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  const add = async () => {
    if (!name.trim()) return;
    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("title", title.trim() || name.trim());
    fd.set("recurrence", recurrence);
    await createTemplate(boardId, fd);
    setName("");
    setTitle("");
    setRecurrence("none");
    toast("Vorlage gespeichert");
    reload();
  };

  const apply = async (id: string) => {
    await applyTemplate(boardId, id);
    toast("Task aus Vorlage erstellt");
    router.refresh();
  };

  const remove = async (id: string) => {
    setItems((p) => p?.filter((t) => t.id !== id) ?? null);
    await deleteTemplate(boardId, id);
  };

  return (
    <div style={{ padding: 10, minWidth: 260 }}>
      <div style={head}>Vorlagen</div>
      {items === null && <p style={muted}>Lädt …</p>}
      {items && items.length === 0 && <p style={muted}>Noch keine Vorlagen.</p>}
      <div style={{ display: "grid", gap: 4, maxHeight: 260, overflowY: "auto" }}>
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
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 13,
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={t.title}
              >
                {t.name}
              </span>
              {t.recurrence !== "none" && (
                <span style={{ fontSize: 11, color: "var(--accent)" }}>
                  ↻ {recLabel[t.recurrence]}
                </span>
              )}
            </span>
            <button onClick={() => apply(t.id)} style={applyBtn}>
              Anlegen
            </button>
            <button
              onClick={() => remove(t.id)}
              title="Vorlage löschen"
              aria-label="Vorlage löschen"
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

      <div style={{ display: "grid", gap: 6, marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
          Neue Vorlage
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (z. B. Newsletter)"
          style={input}
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task-Titel (optional)"
          style={input}
        />
        <select
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value)}
          style={input}
        >
          <option value="none">Einmalig</option>
          <option value="weekly">Wöchentlich (automatisch)</option>
          <option value="monthly">Monatlich (automatisch)</option>
        </select>
        <button onClick={add} style={{ ...applyBtn, padding: "8px 12px" }}>
          + Vorlage speichern
        </button>
      </div>
    </div>
  );
}

const head: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "var(--faint)",
  fontWeight: 700,
  padding: "2px 4px 8px",
};
const muted: React.CSSProperties = {
  color: "var(--faint)",
  fontSize: 13,
  padding: 4,
};
const input: React.CSSProperties = {
  width: "100%",
  background: "var(--input-bg)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "7px 9px",
  color: "var(--text)",
  fontSize: 13,
};
const applyBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "3px 8px",
  color: "var(--accent)",
  fontSize: 12,
  cursor: "pointer",
};
