import { statusPillStyle, urgencyPillStyle } from "@/components/board/pills";
import { deadlineUrgency, formatDate } from "@/lib/format";
import type { PersonTaskRow } from "@/lib/tasks";

// Shared list of tasks (Meine Aufgaben / person pages): board, status pill,
// deadline + urgency badge, overdue accent.
export default function TaskListView({
  rows,
  emptyText,
}: {
  rows: PersonTaskRow[];
  emptyText: string;
}) {
  const today = new Date().toISOString().slice(0, 10);

  if (rows.length === 0) {
    return <p style={{ color: "var(--faint)" }}>{emptyText}</p>;
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map((t) => {
        const overdue =
          t.deadline && t.deadline < today && t.status !== "Fertig";
        const urgency =
          t.deadline && t.status !== "Fertig"
            ? deadlineUrgency(t.deadline)
            : null;
        return (
          <a
            key={t.id}
            href={`/boards/${t.board_id}?task=${t.id}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderLeft: `3px solid ${overdue ? "var(--danger)" : "var(--border)"}`,
              borderRadius: 8,
              padding: "10px 14px",
              textDecoration: "none",
              color: "var(--text)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {t.title}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {t.boardName}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexShrink: 0,
                fontSize: 13,
              }}
            >
              {t.status && (
                <span style={statusPillStyle(t.statusColor)}>{t.status}</span>
              )}
              {t.deadline && (
                <span
                  style={{ color: overdue ? "var(--danger)" : "var(--muted)" }}
                >
                  {formatDate(t.deadline)}
                </span>
              )}
              {urgency && (
                <span style={urgencyPillStyle(urgency.tone)}>{urgency.label}</span>
              )}
            </div>
          </a>
        );
      })}
    </div>
  );
}
