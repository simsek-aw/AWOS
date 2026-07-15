"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { postComment, toggleLike } from "@/app/(app)/boards/[id]/actions";
import { createClient } from "@/lib/supabase/client";
import type { Comment, Person, TaskEvent, TaskSuggestion } from "@/lib/types";
import { Avatar } from "./Avatar";
import MentionTextarea from "./MentionTextarea";

function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "gerade eben";
  if (s < 3600) return `vor ${Math.floor(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std.`;
  return `vor ${Math.floor(s / 86400)} Tag(en)`;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Render a comment body with @mentions of known people as coloured pills.
function renderBody(body: string, names: string[]): React.ReactNode {
  if (names.length === 0) return body;
  const re = new RegExp("@(" + names.map(escapeRe).join("|") + ")", "g");
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) out.push(body.slice(last, m.index));
    out.push(
      <span
        key={i++}
        style={{
          background: "rgba(0,115,234,0.18)",
          color: "var(--accent)",
          borderRadius: 5,
          padding: "1px 5px",
          fontWeight: 600,
        }}
      >
        @{m[1]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push(body.slice(last));
  return out;
}

export default function TaskUpdates({
  boardId,
  taskId,
  people,
  currentUserId,
  isEmployee,
  highlightCommentId = null,
}: {
  boardId: string;
  taskId: string;
  people: Person[];
  currentUserId: string;
  isEmployee: boolean;
  highlightCommentId?: string | null;
}) {
  const [tab, setTab] = useState<"updates" | "activity">("updates");
  const [flashId, setFlashId] = useState<string | null>(highlightCommentId);
  const [summary, setSummary] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<TaskSuggestion | null>(null);
  const flashRef = useRef<HTMLDivElement | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [customerTaskId, setCustomerTaskId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [, startTransition] = useTransition();

  const peopleName = useMemo(
    () => new Map(people.map((p) => [p.id, p.name])),
    [people],
  );
  const names = useMemo(() => people.map((p) => p.name), [people]);

  const load = useCallback(async () => {
    const supabase = createClient();

    // Determine the mirror group (employees only; RLS blocks task_links else).
    let threadIds = [taskId];
    let custId: string | null = null;
    const { data: asInternal } = await supabase
      .from("task_links")
      .select("customer_task_id")
      .eq("internal_task_id", taskId)
      .maybeSingle<{ customer_task_id: string }>();
    if (asInternal) {
      custId = asInternal.customer_task_id;
      const { data: sibs } = await supabase
        .from("task_links")
        .select("internal_task_id")
        .eq("customer_task_id", custId)
        .returns<{ internal_task_id: string }[]>();
      threadIds = [custId, ...(sibs ?? []).map((s) => s.internal_task_id)];
    }
    setCustomerTaskId(custId);

    const { data: cmts } = await supabase
      .from("comments")
      .select("*")
      .in("task_id", threadIds)
      .order("created_at", { ascending: true })
      .returns<Comment[]>();
    const list = cmts ?? [];
    setComments(list);

    const ids = list.map((c) => c.id);
    if (ids.length) {
      const { data: likeRows } = await supabase
        .from("comment_likes")
        .select("comment_id, user_id")
        .in("comment_id", ids)
        .returns<{ comment_id: string; user_id: string }[]>();
      const counts: Record<string, number> = {};
      const mine = new Set<string>();
      for (const l of likeRows ?? []) {
        counts[l.comment_id] = (counts[l.comment_id] ?? 0) + 1;
        if (l.user_id === currentUserId) mine.add(l.comment_id);
      }
      setLikes(counts);
      setMyLikes(mine);
    } else {
      setLikes({});
      setMyLikes(new Set());
    }

    const { data: sum } = await supabase
      .from("task_summaries")
      .select("summary")
      .eq("task_id", taskId)
      .maybeSingle<{ summary: string }>();
    setSummary(sum?.summary ?? null);

    if (isEmployee) {
      const { data: sug } = await supabase
        .from("task_suggestions")
        .select("*")
        .eq("task_id", taskId)
        .maybeSingle<TaskSuggestion>();
      setSuggestion(sug ?? null);
    }

    if (isEmployee) {
      const { data: evs } = await supabase
        .from("task_events")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
        .returns<TaskEvent[]>();
      setEvents(evs ?? []);
    }
  }, [taskId, currentUserId, isEmployee]);

  useEffect(() => {
    const supabase = createClient();
    let ch: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (s.session?.access_token) {
        supabase.realtime.setAuth(s.session.access_token);
      }
      await load();
      ch = supabase.channel(`updates-${taskId}`);
      for (const table of [
        "comments",
        "comment_likes",
        "task_events",
        "task_summaries",
        "task_suggestions",
      ]) {
        ch.on(
          "postgres_changes",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { event: "*", schema: "public", table } as any,
          () => load(),
        );
      }
      ch.subscribe();
    })();
    return () => {
      if (ch) supabase.removeChannel(ch);
    };
  }, [taskId, load]);

  // Follow a notification link: switch to Updates and flash the comment.
  useEffect(() => {
    setFlashId(highlightCommentId);
    if (highlightCommentId) setTab("updates");
  }, [highlightCommentId]);

  useEffect(() => {
    if (!flashId || !comments.some((c) => c.id === flashId)) return;
    const t1 = setTimeout(
      () => flashRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
      200,
    );
    const t2 = setTimeout(() => setFlashId(null), 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [flashId, comments]);

  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) =>
    comments.filter((c) => c.parent_id === id);

  const submitTop = () => {
    const text = body.trim();
    if (!text) return;
    startTransition(async () => {
      await postComment(boardId, taskId, text, null);
      setBody("");
      await load();
    });
  };

  const submitReply = (parentId: string) => {
    const text = replyBody.trim();
    if (!text) return;
    startTransition(async () => {
      await postComment(boardId, taskId, text, parentId);
      setReplyBody("");
      setReplyTo(null);
      await load();
    });
  };

  const like = (commentId: string) => {
    // Optimistic toggle.
    setMyLikes((prev) => {
      const next = new Set(prev);
      const on = next.has(commentId);
      on ? next.delete(commentId) : next.add(commentId);
      setLikes((c) => ({
        ...c,
        [commentId]: Math.max(0, (c[commentId] ?? 0) + (on ? -1 : 1)),
      }));
      return next;
    });
    startTransition(() => toggleLike(boardId, taskId, commentId));
  };

  const authorLabel = (cm: Comment) =>
    cm.is_agent
      ? "AWOS Agent"
      : cm.author_id === currentUserId
        ? "Du"
        : (cm.author_id && peopleName.get(cm.author_id)) ||
          (cm.task_id === customerTaskId ? "Kunde" : "Team");

  const renderComment = (cm: Comment, isReply = false) => {
    const fromCustomer = cm.task_id === customerTaskId;
    const label = authorLabel(cm);
    const isFlash = flashId === cm.id;
    return (
      <div
        key={cm.id}
        ref={isFlash ? flashRef : undefined}
        style={{
          display: "flex",
          gap: 10,
          marginLeft: isReply ? 34 : 0,
          marginTop: isReply ? 10 : 0,
          padding: 6,
          borderRadius: 8,
          background: isFlash ? "rgba(0,115,234,0.12)" : undefined,
          boxShadow: isFlash ? "0 0 0 2px var(--accent)" : undefined,
          transition: "background 500ms ease, box-shadow 500ms ease",
        }}
      >
        <Avatar name={label} size={28} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
            <span style={{ color: "var(--faint)", fontSize: 12 }}>
              {ago(cm.created_at)}
            </span>
            {fromCustomer && (
              <span style={{ color: "var(--accent)", fontSize: 11 }}>
                · Kundenboard
              </span>
            )}
          </div>
          <div style={{ fontSize: 14, margin: "3px 0 4px", whiteSpace: "pre-wrap" }}>
            {renderBody(cm.body, names)}
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <button
              onClick={() => like(cm.id)}
              style={{
                ...linkBtn,
                color: myLikes.has(cm.id) ? "var(--accent)" : "var(--muted)",
              }}
            >
              👍 Liken{likes[cm.id] ? ` (${likes[cm.id]})` : ""}
            </button>
            {!isReply && (
              <button
                onClick={() =>
                  setReplyTo((r) => (r === cm.id ? null : cm.id))
                }
                style={linkBtn}
              >
                ↩ Antworten
              </button>
            )}
          </div>

          {replyTo === cm.id && (
            <div style={{ marginTop: 8 }}>
              <MentionTextarea
                people={people}
                value={replyBody}
                onChange={setReplyBody}
                placeholder="Antwort schreiben… (@ erwähnt jemanden)"
                rows={2}
              />
              <button
                onClick={() => submitReply(cm.id)}
                disabled={!replyBody.trim()}
                style={{ ...primaryBtn, marginTop: 6, opacity: replyBody.trim() ? 1 : 0.6 }}
              >
                Antworten
              </button>
            </div>
          )}

          {repliesOf(cm.id).map((r) => renderComment(r, true))}
        </div>
      </div>
    );
  };

  const deptLabel: Record<string, string> = {
    marketing: "Marketing",
    content: "Content",
    grafik: "Grafik",
  };
  const prioColor: Record<string, string> = {
    niedrig: "#9e9e9e",
    mittel: "#579bfc",
    hoch: "#fdab3d",
    dringend: "#e2445c",
  };

  return (
    <section style={{ marginTop: 32 }}>
      {suggestion && (suggestion.department || suggestion.priority) && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
            background: "var(--surface-2)",
            border: "1px dashed var(--border)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          <span style={{ fontWeight: 700 }}>🤖 Triage-Vorschlag</span>
          {suggestion.department && (
            <span>
              Abteilung: <strong>{deptLabel[suggestion.department] ?? suggestion.department}</strong>
            </span>
          )}
          {suggestion.priority && (
            <span
              style={{
                background: prioColor[suggestion.priority] ?? "var(--muted)",
                color: "#fff",
                borderRadius: 6,
                padding: "1px 8px",
                fontWeight: 600,
              }}
            >
              {suggestion.priority}
            </span>
          )}
          {suggestion.assignee_id && peopleName.get(suggestion.assignee_id) && (
            <span>
              Macher: <strong>{peopleName.get(suggestion.assignee_id)}</strong>
            </span>
          )}
          {suggestion.reasoning && (
            <span style={{ color: "var(--muted)", flexBasis: "100%" }}>
              {suggestion.reasoning}
            </span>
          )}
        </div>
      )}

      {summary && (
        <div
          style={{
            display: "flex",
            gap: 10,
            background: "rgba(0,115,234,0.08)",
            border: "1px solid var(--border)",
            borderLeft: "3px solid var(--accent)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1.4 }}>🤖</span>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.4,
                color: "var(--muted)",
                marginBottom: 2,
              }}
            >
              KI-Zusammenfassung
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>{summary}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 20, borderBottom: "1px solid var(--border)" }}>
        <Tab active={tab === "updates"} onClick={() => setTab("updates")}>
          Updates{topLevel.length ? ` / ${topLevel.length}` : ""}
        </Tab>
        {isEmployee && (
          <Tab active={tab === "activity"} onClick={() => setTab("activity")}>
            Aktivitätsprotokoll
          </Tab>
        )}
      </div>

      {tab === "updates" && (
        <>
          <div style={{ margin: "16px 0" }}>
            <MentionTextarea
              people={people}
              value={body}
              onChange={setBody}
              placeholder="Schreibe eine Aktualisierung und erwähne andere mit @"
            />
            <button
              onClick={submitTop}
              disabled={!body.trim()}
              style={{ ...primaryBtn, marginTop: 8, opacity: body.trim() ? 1 : 0.6 }}
            >
              Aktualisierung posten
            </button>
          </div>

          <div style={{ display: "grid", gap: 18 }}>
            {topLevel.map((cm) => (
              <div
                key={cm.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 14,
                  background: "var(--panel)",
                }}
              >
                {renderComment(cm)}
              </div>
            ))}
            {topLevel.length === 0 && (
              <p style={{ color: "var(--faint)" }}>Noch keine Updates.</p>
            )}
          </div>
        </>
      )}

      {tab === "activity" && isEmployee && (
        <div style={{ display: "grid", gap: 2, marginTop: 16 }}>
          {events.map((e) => (
            <div
              key={e.id}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "baseline",
                padding: "8px 4px",
                borderBottom: "1px solid var(--border)",
                fontSize: 14,
              }}
            >
              <span style={{ color: "var(--faint)", fontSize: 12, minWidth: 110 }}>
                {ago(e.created_at)}
              </span>
              <span style={{ color: "var(--muted)", minWidth: 90 }}>
                {(e.actor_id && peopleName.get(e.actor_id)) || "System"}
              </span>
              <span>{e.summary}</span>
            </div>
          ))}
          {events.length === 0 && (
            <p style={{ color: "var(--faint)" }}>Noch keine Aktivität.</p>
          )}
        </div>
      )}
    </section>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
        color: active ? "var(--text)" : "var(--muted)",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        padding: "8px 2px",
        marginBottom: -1,
      }}
    >
      {children}
    </button>
  );
}

const linkBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--muted)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  padding: 0,
};

const primaryBtn: React.CSSProperties = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "8px 16px",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 14,
};
