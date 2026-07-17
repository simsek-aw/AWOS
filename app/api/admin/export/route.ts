import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type BoardRow = { id: string; name: string; type: string; customer_id: string | null };
type GroupRow = { id: string; name: string };
type CustomerRow = { id: string; name: string };
type TaskRow = {
  id: string;
  board_id: string;
  group_id: string | null;
  title: string;
  customer_id: string | null;
  parent_id: string | null;
  created_at: string;
  archived_at: string | null;
  deleted_at: string | null;
};

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

// Admin export of boards + tasks as JSON or CSV (?format=json|csv).
export async function GET(req: Request) {
  await requireAdmin();
  const format = new URL(req.url).searchParams.get("format") ?? "json";
  const svc = createServiceClient();

  const [boardsRes, groupsRes, customersRes, tasksRes] = await Promise.all([
    svc.from("boards").select("id, name, type, customer_id").returns<BoardRow[]>(),
    svc.from("groups").select("id, name").returns<GroupRow[]>(),
    svc.from("customers").select("id, name").returns<CustomerRow[]>(),
    svc
      .from("tasks")
      .select(
        "id, board_id, group_id, title, customer_id, parent_id, created_at, archived_at, deleted_at",
      )
      .returns<TaskRow[]>(),
  ]);

  const boards = boardsRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const boardName = new Map(boards.map((b) => [b.id, b.name]));
  const groupName = new Map((groupsRes.data ?? []).map((g) => [g.id, g.name]));
  const customerName = new Map(
    (customersRes.data ?? []).map((c) => [c.id, c.name]),
  );
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const header = [
      "Board",
      "Titel",
      "Gruppe",
      "Kunde",
      "Subitem",
      "Erstellt",
      "Archiviert",
      "Gelöscht",
    ];
    const lines = [header.map(csvCell).join(",")];
    for (const t of tasks) {
      lines.push(
        [
          boardName.get(t.board_id) ?? "",
          t.title,
          t.group_id ? (groupName.get(t.group_id) ?? "") : "",
          t.customer_id ? (customerName.get(t.customer_id) ?? "") : "",
          t.parent_id ? "ja" : "",
          t.created_at,
          t.archived_at ?? "",
          t.deleted_at ?? "",
        ]
          .map(csvCell)
          .join(","),
      );
    }
    // BOM so Excel opens UTF-8 correctly.
    return new NextResponse("﻿" + lines.join("\r\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="awos-tasks-${stamp}.csv"`,
      },
    });
  }

  return new NextResponse(
    JSON.stringify({ exportedAt: new Date().toISOString(), boards, tasks }, null, 2),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="awos-export-${stamp}.json"`,
      },
    },
  );
}
