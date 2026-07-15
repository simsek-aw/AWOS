"use client";

import { useRef, useState } from "react";
import type { Person } from "@/lib/types";

// Textarea with @-mention autocomplete. Works controlled (value + onChange, for
// the drawer) or self-managed with a `name` (for a server-action <form>).
export default function MentionTextarea({
  people,
  name,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  people: Person[];
  name?: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [internal, setInternal] = useState("");
  const text = value !== undefined ? value : internal;
  const setText = (t: string) => (onChange ? onChange(t) : setInternal(t));

  const [menu, setMenu] = useState<{ start: number; query: string } | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  const update = (v: string, caret: number) => {
    setText(v);
    const m = v.slice(0, caret).match(/@([^\s@]*)$/);
    setMenu(m ? { start: caret - m[1].length - 1, query: m[1].toLowerCase() } : null);
  };

  const matches = menu
    ? people.filter((p) => p.name.toLowerCase().includes(menu.query)).slice(0, 6)
    : [];

  const pick = (p: Person) => {
    if (!menu) return;
    const caret = ref.current?.selectionStart ?? menu.start;
    const before = text.slice(0, menu.start);
    const after = text.slice(caret);
    const insert = `@${p.name} `;
    setText(before + insert + after);
    setMenu(null);
    requestAnimationFrame(() => {
      const pos = (before + insert).length;
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
    });
  };

  return (
    <div style={{ position: "relative" }}>
      <textarea
        ref={ref}
        name={name}
        rows={rows}
        value={text}
        placeholder={placeholder}
        onChange={(e) => update(e.target.value, e.target.selectionStart)}
        onKeyUp={(e) =>
          update(
            (e.target as HTMLTextAreaElement).value,
            (e.target as HTMLTextAreaElement).selectionStart,
          )
        }
        onBlur={() => setTimeout(() => setMenu(null), 120)}
        style={{
          width: "100%",
          background: "var(--input-bg)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "10px 12px",
          color: "var(--text)",
          fontSize: 14,
          resize: "vertical",
          fontFamily: "inherit",
        }}
      />
      {menu && matches.length > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "100%",
            zIndex: 30,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            marginTop: 4,
            boxShadow: "var(--shadow)",
            overflow: "hidden",
          }}
        >
          {matches.map((p) => (
            <div
              key={p.id}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              @{p.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
