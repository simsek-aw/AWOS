"use client";

import { useEffect, useRef, useState } from "react";
import {
  type ChatSummary,
  deleteAgentChat,
  loadAgentChat,
  sendAgentMessage,
} from "@/app/(app)/agents/actions";
import Icon from "@/components/icons";
import type { ChatMessage } from "@/lib/agent/assistant";

// Generic, persistence-aware agent chat. Threads are saved per user; a history
// menu lets you reopen or delete past conversations.
export default function AgentChat({
  agent,
  examples,
  intro,
  placeholder = "Nachricht schreiben…",
  initialChats = [],
}: {
  agent: "assistant" | "creative";
  examples: string[];
  intro: string;
  placeholder?: string;
  initialChats?: ChatSummary[];
}) {
  const [chats, setChats] = useState<ChatSummary[]>(initialChats);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await sendAgentMessage(agent, chatId, q);
      setChatId(res.chatId);
      setMessages(res.messages);
      setChats((prev) => {
        const rest = prev.filter((c) => c.id !== res.chatId);
        return [
          {
            id: res.chatId,
            title: res.title,
            updated_at: new Date().toISOString(),
          },
          ...rest,
        ];
      });
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Es gab ein Problem bei der Anfrage." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const newChat = () => {
    setChatId(null);
    setMessages([]);
    setHistOpen(false);
  };

  const openChat = async (id: string) => {
    setHistOpen(false);
    const chat = await loadAgentChat(id);
    if (chat) {
      setChatId(chat.id);
      setMessages(chat.messages);
    }
  };

  const removeChat = async (id: string) => {
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (id === chatId) newChat();
    await deleteAgentChat(id);
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
      {/* Top bar: new chat + history */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          borderBottom: "1px solid var(--border)",
          position: "relative",
        }}
      >
        <button onClick={newChat} style={barBtn} title="Neuer Chat">
          <Icon name="plus" size={15} /> Neuer Chat
        </button>
        <button
          onClick={() => setHistOpen((v) => !v)}
          style={barBtn}
          title="Verlauf"
        >
          <Icon name="message" size={15} /> Verlauf
          {chats.length > 0 ? ` (${chats.length})` : ""}
        </button>

        {histOpen && (
          <>
            <div
              onClick={() => setHistOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: 20 }}
            />
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 10,
                width: 280,
                maxHeight: 320,
                overflowY: "auto",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                zIndex: 30,
                boxShadow: "0 12px 34px rgba(0,0,0,0.5)",
                padding: 6,
              }}
            >
              {chats.length === 0 && (
                <div style={{ padding: 10, color: "var(--faint)", fontSize: 13 }}>
                  Noch keine gespeicherten Chats.
                </div>
              )}
              {chats.map((c) => (
                <div
                  key={c.id}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <button
                    onClick={() => openChat(c.id)}
                    style={{
                      flex: 1,
                      textAlign: "left",
                      background:
                        c.id === chatId ? "var(--active)" : "transparent",
                      border: "none",
                      borderRadius: 6,
                      padding: "8px 10px",
                      color: "var(--text)",
                      fontSize: 13,
                      cursor: "pointer",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.title || "Ohne Titel"}
                  </button>
                  <button
                    onClick={() => removeChat(c.id)}
                    title="Löschen"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--danger)",
                      cursor: "pointer",
                      display: "inline-flex",
                      padding: 4,
                    }}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {messages.length === 0 && (
          <div style={{ color: "var(--muted)", fontSize: 14 }}>
            <p style={{ marginTop: 0 }}>{intro}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {examples.map((ex) => (
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
                    textAlign: "left",
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
                  border: m.role === "user" ? "none" : "1px solid var(--border)",
                }}
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && (
            <div style={{ color: "var(--faint)", fontSize: 13 }}>Denkt nach …</div>
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
          placeholder={placeholder}
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

const barBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "6px 10px",
  color: "var(--muted)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
