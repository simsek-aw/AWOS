import type { Column, StatusOption, Task } from "@/lib/types";

export function shortId(id: string) {
  return id.slice(0, 8);
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
    return <span style={{ color: "#5b6472" }}>—</span>;
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
    case "link":
      return (
        <a href={str} target="_blank" rel="noopener noreferrer">
          Öffnen
        </a>
      );
    default:
      return <span>{str}</span>;
  }
}
