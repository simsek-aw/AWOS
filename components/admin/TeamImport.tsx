"use client";

import { useState, useTransition } from "react";
import { importTeam } from "@/app/admin/actions";

type Row = { name: string; email: string; department: string; titel: string };

const norm = (s: string) => s.trim().toLowerCase();

// Parse a simple delimited CSV (auto-detects ; or ,). No embedded-newline
// handling needed for a contacts export.
function parse(text: string): string[][] {
  const t = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const first = t.split("\n")[0] ?? "";
  const delim = (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  return t
    .split("\n")
    .map((line) => line.split(delim).map((c) => c.trim().replace(/^"|"$/g, "")))
    .filter((r) => r.some((c) => c !== ""));
}

function mapDeptLabel(s: string): string {
  const d = norm(s);
  if (d.includes("grafik")) return "Grafik";
  if (d.includes("content")) return "Content";
  if (d.includes("marketing")) return "Marketing";
  return "—";
}

export default function TeamImport() {
  const [rows, setRows] = useState<Row[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onFile = async (f: File) => {
    setResult(null);
    const buf = await f.arrayBuffer();
    // Excel/Windows exports are often Windows-1252; fall back to it if UTF-8
    // decoding produces replacement characters (mangled umlauts).
    let text = new TextDecoder("utf-8").decode(buf);
    if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buf);

    const grid = parse(text);
    if (!grid.length) return;
    const head = grid[0].map(norm);
    const idx = (...names: string[]) =>
      head.findIndex((h) => names.some((n) => h.includes(n)));
    const iName = idx("name");
    const iMail = idx("mail", "email", "e-mail");
    const iDept = idx("abteilung", "department");
    const iTitel = idx("titel", "position", "rolle");

    const parsed: Row[] = grid
      .slice(1)
      .map((r) => ({
        name: iName >= 0 ? (r[iName] ?? "") : "",
        email: iMail >= 0 ? (r[iMail] ?? "") : "",
        department: iDept >= 0 ? (r[iDept] ?? "") : "",
        titel: iTitel >= 0 ? (r[iTitel] ?? "") : "",
      }))
      .filter((r) => r.name && r.email.includes("@"));

    // Dedupe by name (keep first) for a clean preview.
    const seen = new Set<string>();
    setRows(parsed.filter((r) => (seen.has(norm(r.name)) ? false : seen.add(norm(r.name)))));
  };

  const run = () => {
    if (!rows.length) return;
    start(async () => {
      const res = await importTeam(
        rows.map((r) => ({ name: r.name, email: r.email, department: r.department })),
      );
      setResult(
        `${res.created} angelegt, ${res.skipped} übersprungen${
          res.errors.length ? ` · ${res.errors.join("; ")}` : ""
        }.`,
      );
      setRows([]);
    });
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
        CSV mit Spalten <em>Name; E-Mail; Titel; Abteilung</em> hochladen. Es werden
        interne Mitarbeiter-Konten <strong>ohne E-Mail-Versand</strong> angelegt
        (Login-Einladung später). Abteilung wird auf Marketing/Content/Grafik
        gemappt; alles andere bleibt ohne Abteilung.
      </p>

      <input
        type="file"
        accept=".csv,text/csv,text/plain"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
        style={{ fontSize: 13, color: "var(--muted)" }}
      />

      {rows.length > 0 && (
        <>
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              overflow: "hidden",
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            {rows.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "7px 12px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 13,
                }}
              >
                <span style={{ flex: 1, fontWeight: 600 }}>{r.name}</span>
                <span style={{ flex: 1, color: "var(--muted)" }}>{r.email}</span>
                <span style={{ width: 90, color: "var(--faint)" }}>
                  {mapDeptLabel(r.department)}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={run}
            disabled={pending}
            style={{
              justifySelf: "start",
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "9px 16px",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {pending ? "Lege an…" : `${rows.length} Mitglieder anlegen`}
          </button>
        </>
      )}

      {result && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            background: "var(--ok-bg)",
            color: "var(--ok-text)",
            fontSize: 14,
          }}
        >
          {result}
        </div>
      )}
    </div>
  );
}
