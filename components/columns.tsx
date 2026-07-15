import type { Column, StatusOption, Task } from "@/lib/types";

export function shortId(id: string) {
  return id.slice(0, 8);
}

/**
 * Returns the URL only if it is a safe http/https link. Prevents stored XSS via
 * `javascript:` / `data:` values in user-controlled link columns, which would
 * otherwise execute in the session of anyone (e.g. an employee) who clicks it.
 */
export function safeHttpUrl(value: string): string | null {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

function statusColor(column: Column, value: string): string {
  const opt = (column.options.options ?? []).find(
    (o: StatusOption) => o.label === value,
  );
  return opt?.color ?? "#9e9e9e";
}

/** Read-only display of a task/column value for the board table. */
export function renderCell(
  column: Column,
  task: Task,
  value: unknown,
): React.ReactNode {
  // The two columns bound to the task row itself:
  if (column.key === "task_id") {
    return <code style={{ color: "var(--muted)" }}>{shortId(task.id)}</code>;
  }
  if (column.key === "name") {
    return (
      <a href={`/boards/${task.board_id}/tasks/${task.id}`}>{task.title}</a>
    );
  }

  if (value === null || value === undefined || value === "") {
    return <span style={{ color: "var(--faint)" }}>—</span>;
  }
  const str = String(value);

  switch (column.type) {
    case "status":
      return (
        <span
          style={{
            background: statusColor(column, str),
            color: "#0d0f13",
            borderRadius: 6,
            padding: "2px 8px",
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {str}
        </span>
      );
    case "link": {
      const safe = safeHttpUrl(str);
      if (!safe) return <span style={{ color: "var(--faint)" }}>{str}</span>;
      return (
        <a href={safe} target="_blank" rel="noopener noreferrer">
          Öffnen
        </a>
      );
    }
    default:
      return <span>{str}</span>;
  }
}
