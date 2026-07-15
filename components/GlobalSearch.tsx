"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./icons";

type Results = {
  boards: { id: string; name: string; type: string }[];
  tasks: { id: string; title: string; boardId: string; boardName: string }[];
  updates: {
    id: string;
    taskId: string;
    boardId: string;
    taskTitle: string;
    boardName: string;
    snippet: string;
  }[];
  people: { id: string; name: string; role: string }[];
};

const EMPTY: Results = { boards: [], tasks: [], updates: [], people: [] };

const SCOPES: { key: string; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "boards", label: "Boards" },
  { key: "tasks", label: "Aufgaben" },
  { key: "updates", label: "Updates" },
  { key: "people", label: "Personen" },
];

export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("all");
  const [scopeOpen, setScopeOpen] = useState(false);
  const [res, setRes] = useState<Results>(EMPTY);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced fetch as the user types.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setRes(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/search?q=${encodeURIComponent(term)}&scope=${scope}`,
          { signal: ctrl.signal },
        );
        if (r.ok) setRes(await r.json());
      } catch {
        /* aborted or offline — ignore */
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, scope]);

  // Close the results panel on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setScopeOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const total =
    res.boards.length + res.tasks.length + res.updates.length + res.people.length;
  const scopeLabel = SCOPES.find((s) => s.key === scope)?.label ?? "Alle";

  return (
    <div
      ref={boxRef}
      style={{ position: "relative", flex: 1, maxWidth: 560 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--input-bg)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "0 10px 0 12px",
          height: 38,
        }}
      >
        <span style={{ color: "var(--faint)", display: "inline-flex" }}>
          <Icon name="search" size={16} />
        </span>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Alles durchsuchen …"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--text)",
            fontSize: 14,
          }}
        />

        {/* Scope selector */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setScopeOpen((v) => !v)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--muted)",
              fontSize: 12,
              padding: "4px 8px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {scopeLabel}
            <Icon name="chevron-down" size={12} />
          </button>
          {scopeOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "130%",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                zIndex: 60,
                minWidth: 130,
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                overflow: "hidden",
              }}
            >
              {SCOPES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    setScope(s.key);
                    setScopeOpen(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    background: s.key === scope ? "var(--active)" : "transparent",
                    border: "none",
                    color: "var(--text)",
                    fontSize: 13,
                    padding: "8px 12px",
                    cursor: "pointer",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {open && q.trim().length >= 2 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "120%",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            zIndex: 55,
            maxHeight: 460,
            overflowY: "auto",
            boxShadow: "0 14px 40px rgba(0,0,0,0.55)",
          }}
        >
          {loading && total === 0 && (
            <p style={sectionEmpty}>Suche läuft …</p>
          )}
          {!loading && total === 0 && (
            <p style={sectionEmpty}>Keine Treffer für „{q.trim()}".</p>
          )}

          {res.boards.length > 0 && (
            <Section title="Boards">
              {res.boards.map((b) => (
                <ResultRow
                  key={b.id}
                  href={`/boards/${b.id}`}
                  icon="group"
                  title={b.name}
                  sub={b.type === "customer" ? "Kundenboard" : "Internes Board"}
                />
              ))}
            </Section>
          )}

          {res.tasks.length > 0 && (
            <Section title="Aufgaben">
              {res.tasks.map((t) => (
                <ResultRow
                  key={t.id}
                  href={`/boards/${t.boardId}?task=${t.id}`}
                  icon="check"
                  title={t.title}
                  sub={t.boardName}
                />
              ))}
            </Section>
          )}

          {res.updates.length > 0 && (
            <Section title="Updates">
              {res.updates.map((u) => (
                <ResultRow
                  key={u.id}
                  href={`/boards/${u.boardId}?task=${u.taskId}&comment=${u.id}`}
                  icon="message"
                  title={u.snippet}
                  sub={`${u.taskTitle} · ${u.boardName}`}
                />
              ))}
            </Section>
          )}

          {res.people.length > 0 && (
            <Section title="Personen">
              {res.people.map((p) => (
                <ResultRow
                  key={p.id}
                  href={`/people/${p.id}`}
                  icon="user"
                  title={p.name}
                  sub={p.role}
                />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "var(--faint)",
          padding: "10px 14px 4px",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function ResultRow({
  href,
  icon,
  title,
  sub,
}: {
  href?: string;
  icon: Parameters<typeof Icon>[0]["name"];
  title: string;
  sub: string;
}) {
  const inner = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <span
        style={{
          display: "inline-flex",
          color: "var(--muted)",
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={16} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            color: "var(--text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  );

  const style: React.CSSProperties = {
    display: "block",
    padding: "8px 14px",
    textDecoration: "none",
  };

  if (!href) {
    return <div style={{ ...style, cursor: "default" }}>{inner}</div>;
  }
  return (
    <a href={href} style={style} className="search-result">
      {inner}
    </a>
  );
}

const sectionEmpty: React.CSSProperties = {
  color: "var(--faint)",
  fontSize: 14,
  padding: 16,
  margin: 0,
};
