"use client";

import { useEffect, useRef, useState } from "react";
import { askAwosAssistant } from "@/app/(app)/agents/actions";
import Icon from "@/components/icons";
import type { ChatMessage } from "@/lib/agent/assistant";

const EXAMPLES = [
  "Was ist diese Woche überfällig?",
  "Welche Aufgaben haben keine Deadline?",
  "Wer hat aktuell die meisten offenen Aufgaben?",
  "Fasse die offenen Aufgaben pro Board zusammen.",
];

export default function AssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const reply = await askAwosAssistant(next);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Es gab ein Problem bei der Anfrage." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 220px)",
        minHeight: 360,
        border: "1px solid var(--border)",
        borderRadius: 12,
        background: "var(--surface)",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {messages.length === 0 && (
          <div style={{ color: "var(--muted)", fontSize: 14 }}>
            <p style={{ marginTop: 0 }}>
              Frag mich etwas zu deinen Boards und Aufgaben. Zum Beispiel:
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => send(ex)}
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 999,
                    padding: "7px 12px",
                    color: "var(--text)",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gap: 12 }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "80%",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.5,
                  fontSize: 14,
                  padding: "10px 14px",
                  borderRadius: 12,
                  background:
                    m.role === "user" ? "var(--accent)" : "var(--surface-2)",
                  color: m.role === "user" ? "#fff" : "var(--text)",
                  border:
                    m.role === "user" ? "none" : "1px solid var(--border)",
                }}
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && (
            <div style={{ color: "var(--faint)", fontSize: 13 }}>
              Assistent denkt nach …
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        style={{
          display: "flex",
          gap: 8,
          padding: 12,
          borderTop: "1px solid var(--border)",
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Frage stellen…"
          disabled={busy}
          style={{
            flex: 1,
            background: "var(--input-bg)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "10px 12px",
            color: "var(--text)",
            fontSize: 14,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "0 16px",
            fontWeight: 600,
            fontSize: 14,
            cursor: busy || !input.trim() ? "default" : "pointer",
            opacity: busy || !input.trim() ? 0.6 : 1,
          }}
        >
          <Icon name="arrow-right" size={16} /> Senden
        </button>
      </form>
    </div>
  );
}
