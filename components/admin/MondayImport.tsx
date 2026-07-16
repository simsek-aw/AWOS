"use client";

import { useMemo, useState, useTransition } from "react";
import {
  getImportColumns,
  type ImportColumn,
  type ImportRow,
  importBoardRows,
  undoImport,
} from "@/app/admin/import/actions";

type Board = { id: string; name: string; type: string };
type Person = { id: string; name: string };

// Special mapping targets besides a concrete column id.
const IGNORE = "__ignore";
const TITLE = "__title";
const GROUP = "__group";
const CUSTOMER = "__customer";

// --- CSV parsing ----------------------------------------------------------
function detectDelimiter(line: string): string {
  const counts: Record<string, number> = {
    ",": (line.match(/,/g) || []).length,
    ";": (line.match(/;/g) || []).length,
    "\t": (line.match(/\t/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ",";
}

function parseCsv(text: string): string[][] {
  // Strip a UTF-8 BOM (Excel exports one) so the first header isn't corrupted.
  const t = text
    .replace(/^﻿/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
  if (!t) return [];
  const delim = detectDelimiter(t.split("\n")[0]);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inQuotes) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function parseDate(raw: string): string {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/.exec(s);
  if (m)
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  // Excel serial date (e.g. "46217" or "46217.0") — epoch 1899-12-30.
  const num = /^(\d{4,6})(?:\.0+)?$/.exec(s);
  if (num) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(num[1]) * 86400000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  return s;
}

// Normalize a monday board export into a clean table with a leading "Gruppe"
// column. Handles: board-title row, section rows, repeated "Name" headers, and
// subitem blocks (skipped — a different sub-schema). A single-cell row is a
// section only when the next non-blank row is a "Name" header; otherwise it's a
// title-only task.
function normalizeMonday(raw: string[][]): {
  rows: string[][];
  monday: boolean;
  skippedSubitems: number;
} {
  const headerIdx = raw.findIndex((r) => (r[0] ?? "").trim() === "Name");
  const singleCol = raw.some(
    (r) => r.filter((c) => (c ?? "").trim() !== "").length === 1,
  );
  if (headerIdx < 0 || (headerIdx === 0 && !singleCol)) {
    return { rows: raw, monday: false, skippedSubitems: 0 };
  }
  const header = ["Gruppe", ...raw[headerIdx]];
  const out: string[][] = [header];
  let group = "";
  let sawHeader = false;
  let skippedSubitems = 0;
  const blank = (r: string[]) => r.every((c) => (c ?? "").trim() === "");

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    const c0 = (row[0] ?? "").trim();
    const filled = row.filter((c) => (c ?? "").trim() !== "");
    if (c0 === "Name") {
      sawHeader = true;
      continue; // repeated header
    }
    if (c0 === "Subitems") continue; // subitem sub-header
    if (filled.length === 0) continue;
    if (filled.length === 1) {
      // Section header only if the next non-blank row is a "Name" header.
      let j = i + 1;
      while (j < raw.length && blank(raw[j])) j++;
      const nextHeader = j < raw.length && (raw[j][0] ?? "").trim() === "Name";
      if (nextHeader) {
        group = c0;
        continue;
      }
      if (!sawHeader) continue; // board title before any header
      out.push([group, ...row]); // title-only task
      continue;
    }
    // A subitem row has an empty first (Name) cell — skip it.
    if (c0 === "") {
      skippedSubitems++;
      continue;
    }
    out.push([group, ...row]);
  }
  return { rows: out, monday: true, skippedSubitems };
}

const norm = (s: string) => s.trim().toLowerCase();

export default function MondayImport({
  boards,
  people,
}: {
  boards: Board[];
  people: Person[];
}) {
  const [fileMsg, setFileMsg] = useState<string | null>(null);
  const [boardId, setBoardId] = useState("");
  const [columns, setColumns] = useState<ImportColumn[]>([]);
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<string[]>([]); // per CSV column
  const [personMap, setPersonMap] = useState<Record<string, string>>({});
  const [result, setResult] = useState<
    { message: string; ids: string[] } | null
  >(null);
  const [loadingCols, startCols] = useTransition();
  const [importing, startImport] = useTransition();

  const header = parsed[0] ?? [];
  const dataRows = parsed.slice(1);

  const selectBoard = (id: string) => {
    setBoardId(id);
    setColumns([]);
    setResult(null);
    if (id) startCols(async () => setColumns(await getImportColumns(id)));
  };

  const autoMap = (cols: ImportColumn[], head: string[]): string[] =>
    head.map((h) => {
      const hn = norm(h);
      if (["name", "titel", "aufgabe", "task", "item", "element"].includes(hn))
        return TITLE;
      if (["gruppe", "group"].includes(hn)) return GROUP;
      if (["kunde", "customer", "kunden"].includes(hn)) return CUSTOMER;
      const byLabel = cols.find(
        (c) => norm(c.label) === hn || norm(c.key) === hn,
      );
      if (byLabel) return byLabel.id;
      if (hn.includes("status")) {
        const c = cols.find((x) => x.type === "status");
        if (c) return c.id;
      }
      if (hn.includes("deadline") || hn.includes("datum") || hn.includes("date")) {
        const c = cols.find((x) => x.key === "deadline");
        if (c) return c.id;
      }
      return IGNORE;
    });

  const ingest = (raw2d: string[][]) => {
    const { rows, monday, skippedSubitems } = normalizeMonday(raw2d);
    setParsed(rows);
    setResult(null);
    setFileMsg(
      monday
        ? `monday-Format erkannt: Gruppen als Abschnitte übernommen${
            skippedSubitems ? `, ${skippedSubitems} Subitems übersprungen` : ""
          }.`
        : null,
    );
    if (rows.length) setMapping(autoMap(columns, rows[0]));
  };

  const doParse = () => ingest(parseCsv(raw));

  // Distinct person-cell values across all columns mapped to a person column.
  const personColIdx = useMemo(
    () =>
      mapping
        .map((m, i) => ({ m, i }))
        .filter(({ m }) => columns.find((c) => c.id === m)?.type === "person")
        .map(({ i }) => i),
    [mapping, columns],
  );
  const distinctNames = useMemo(() => {
    const set = new Set<string>();
    for (const r of dataRows)
      for (const i of personColIdx)
        for (const part of (r[i] ?? "").split(/[,;]/))
          if (part.trim()) set.add(part.trim());
    return [...set];
  }, [dataRows, personColIdx]);

  const resolvePerson = (name: string): string => {
    if (personMap[name] !== undefined) return personMap[name];
    const hit = people.find((p) => norm(p.name) === norm(name));
    return hit?.id ?? "";
  };

  const buildRows = (): ImportRow[] => {
    const titleIdx = mapping.indexOf(TITLE);
    const groupIdx = mapping.indexOf(GROUP);
    const customerIdx = mapping.indexOf(CUSTOMER);
    const out: ImportRow[] = [];
    for (const r of dataRows) {
      const title = titleIdx >= 0 ? (r[titleIdx] ?? "").trim() : "";
      if (!title) continue;
      const values: { columnId: string; value: unknown }[] = [];
      mapping.forEach((target, i) => {
        if (
          target === IGNORE ||
          target === TITLE ||
          target === GROUP ||
          target === CUSTOMER
        )
          return;
        const col = columns.find((c) => c.id === target);
        if (!col) return;
        const cell = (r[i] ?? "").trim();
        if (!cell) return;
        if (col.type === "person") {
          const ids = cell
            .split(/[,;]/)
            .map((n) => resolvePerson(n.trim()))
            .filter(Boolean);
          if (ids.length) values.push({ columnId: col.id, value: ids });
        } else if (col.type === "date") {
          values.push({ columnId: col.id, value: parseDate(cell) });
        } else {
          values.push({ columnId: col.id, value: cell });
        }
      });
      out.push({
        group: groupIdx >= 0 ? (r[groupIdx] ?? "").trim() : undefined,
        customerName:
          customerIdx >= 0 ? (r[customerIdx] ?? "").trim() || undefined : undefined,
        title,
        values,
      });
    }
    return out;
  };

  const preview = parsed.length ? buildRows() : [];
  const groupsInPreview = [
    ...new Set(preview.map((r) => r.group || "(Standard)")),
  ];

  const runImport = () => {
    const rows = buildRows();
    if (!boardId || !rows.length) return;
    startImport(async () => {
      const res = await importBoardRows(boardId, rows);
      setResult({
        message: `${res.created} Aufgaben importiert${
          res.groups ? `, ${res.groups} Gruppe(n) angelegt` : ""
        }.`,
        ids: res.createdIds,
      });
    });
  };

  const targetOptions = [
    { v: IGNORE, l: "— ignorieren —" },
    { v: TITLE, l: "Titel (Name)" },
    { v: GROUP, l: "Gruppe" },
    { v: CUSTOMER, l: "Kunde (Zuordnung)" },
    ...columns.map((c) => ({ v: c.id, l: `${c.label} (${c.type})` })),
  ];

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Step 1: board */}
      <div>
        <Label>1 · Ziel-Board</Label>
        <select
          value={boardId}
          onChange={(e) => selectBoard(e.target.value)}
          style={input}
        >
          <option value="">Board wählen…</option>
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.type === "internal" ? "intern" : "Kunde"})
            </option>
          ))}
        </select>
        {loadingCols && <Hint>Spalten werden geladen…</Hint>}
      </div>

      {/* Step 2: paste CSV */}
      {boardId && (
        <div>
          <Label>2 · CSV einfügen oder Datei wählen</Label>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Kopfzeile;Spalte2;… und Datenzeilen aus dem monday-Export (CSV) hier einfügen"
            rows={6}
            style={{ ...input, fontFamily: "monospace", fontSize: 12 }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                f.text().then((t) => {
                  setRaw(t);
                  ingest(parseCsv(t));
                });
              }}
              style={{ fontSize: 13, color: "var(--muted)" }}
            />
            <button onClick={doParse} disabled={!raw.trim()} style={button}>
              CSV einlesen
            </button>
            {fileMsg && (
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{fileMsg}</span>
            )}
          </div>
          <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 6 }}>
            In Excel/Numbers/Google Sheets als <strong>CSV</strong> speichern, dann
            hier hochladen oder einfügen. monday-Gruppen werden automatisch als
            Abschnitte erkannt, Subitems werden übersprungen.
          </p>
        </div>
      )}

      {/* Step 3: mapping */}
      {header.length > 0 && (
        <div>
          <Label>3 · Spalten zuordnen</Label>
          <div style={{ display: "grid", gap: 6 }}>
            {header.map((h, i) => (
              <div
                key={i}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 13,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h || `Spalte ${i + 1}`}
                </span>
                <span style={{ color: "var(--faint)" }}>→</span>
                <select
                  value={mapping[i] ?? IGNORE}
                  onChange={(e) =>
                    setMapping((prev) => {
                      const n = [...prev];
                      n[i] = e.target.value;
                      return n;
                    })
                  }
                  style={{ ...input, width: 220 }}
                >
                  {targetOptions.map((o) => (
                    <option key={o.v} value={o.v}>
                      {o.l}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: person mapping */}
      {distinctNames.length > 0 && (
        <div>
          <Label>4 · Personen zuordnen</Label>
          <div style={{ display: "grid", gap: 6 }}>
            {distinctNames.map((name) => (
              <div
                key={name}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <span style={{ flex: 1, fontSize: 13 }}>{name}</span>
                <span style={{ color: "var(--faint)" }}>→</span>
                <select
                  value={resolvePerson(name)}
                  onChange={(e) =>
                    setPersonMap((prev) => ({ ...prev, [name]: e.target.value }))
                  }
                  style={{ ...input, width: 220 }}
                >
                  <option value="">— ignorieren —</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 5: preview + import */}
      {preview.length > 0 && (
        <div>
          <Label>5 · Vorschau &amp; Import</Label>
          <Hint>
            {preview.length} Aufgaben · Gruppen: {groupsInPreview.join(", ")}
          </Hint>
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              overflow: "hidden",
              marginTop: 8,
            }}
          >
            {preview.slice(0, 8).map((r, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "8px 12px",
                  borderBottom: i < 7 ? "1px solid var(--border)" : "none",
                  fontSize: 13,
                }}
              >
                <span style={{ color: "var(--faint)", width: 90, flexShrink: 0 }}>
                  {r.group || "(Standard)"}
                </span>
                <span style={{ flex: 1 }}>{r.title}</span>
                <span style={{ color: "var(--muted)" }}>
                  {r.values.length} Werte
                </span>
              </div>
            ))}
            {preview.length > 8 && (
              <div style={{ padding: "8px 12px", color: "var(--faint)", fontSize: 12 }}>
                … und {preview.length - 8} weitere
              </div>
            )}
          </div>
          <button
            onClick={runImport}
            disabled={importing}
            style={{ ...button, marginTop: 12 }}
          >
            {importing ? "Importiere…" : `${preview.length} Aufgaben importieren`}
          </button>
          {result && (
            <div
              style={{
                marginTop: 10,
                padding: "10px 12px",
                borderRadius: 8,
                background: "var(--ok-bg)",
                color: "var(--ok-text)",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <span>{result.message}</span>
              {result.ids.length > 0 && (
                <button
                  onClick={() => {
                    if (
                      confirm(
                        `Import rückgängig machen? Löscht die ${result.ids.length} gerade importierten Aufgaben.`,
                      )
                    ) {
                      const ids = result.ids;
                      startImport(async () => {
                        await undoImport(boardId, ids);
                        setResult(null);
                        setParsed([]);
                        setRaw("");
                      });
                    }
                  }}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--ok-text)",
                    color: "var(--ok-text)",
                    borderRadius: 8,
                    padding: "5px 10px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Rückgängig
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
      {children}
    </div>
  );
}
function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
      {children}
    </div>
  );
}

const input: React.CSSProperties = {
  width: "100%",
  background: "var(--input-bg)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 10px",
  color: "var(--text)",
  fontSize: 14,
};

const button: React.CSSProperties = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "9px 16px",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};
