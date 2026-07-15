"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "attachments";
const MAX_BYTES = 10 * 1024 * 1024;

type Row = {
  id: string;
  storage_path: string;
  file_name: string;
  size_bytes: number | null;
  url?: string | null;
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * File attachments for a task, usable client-side (in the drawer). Reads,
 * uploads and deletes go through the user's RLS-scoped Supabase client, so the
 * same storage policies as the server path apply.
 */
export default function TaskAttachments({
  boardId,
  taskId,
}: {
  boardId: string;
  taskId: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [files, setFiles] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data: rows } = await supabase
      .from("attachments")
      .select("id, storage_path, file_name, size_bytes")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true })
      .returns<Row[]>();
    const withUrls = await Promise.all(
      (rows ?? []).map(async (r) => {
        const { data } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(r.storage_path, 3600);
        return { ...r, url: data?.signedUrl ?? null };
      }),
    );
    setFiles(withUrls);
  }, [supabase, taskId]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (file: File) => {
    setErr(null);
    if (file.size === 0) return;
    if (file.size > MAX_BYTES) {
      setErr("Datei zu groß (max. 10 MB).");
      return;
    }
    setBusy(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
      const path = `${boardId}/${taskId}/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) {
        setErr("Upload fehlgeschlagen.");
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from("attachments").insert({
        task_id: taskId,
        storage_path: path,
        file_name: file.name.slice(0, 200),
        size_bytes: file.size,
        content_type: file.type || null,
        uploaded_by: user?.id ?? null,
      });
      if (insErr) {
        await supabase.storage.from(BUCKET).remove([path]);
        setErr("Datei konnte nicht gespeichert werden.");
        return;
      }
      if (inputRef.current) inputRef.current.value = "";
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: Row) => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("attachments")
        .delete()
        .eq("id", row.id);
      if (!error) await supabase.storage.from(BUCKET).remove([row.storage_path]);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ marginTop: 24 }}>
      <h3 style={{ fontSize: 14, margin: "0 0 8px", color: "var(--muted)" }}>
        Dateien
      </h3>
      <div style={{ display: "grid", gap: 6 }}>
        {files.map((f) => (
          <div
            key={f.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "7px 10px",
              fontSize: 13,
            }}
          >
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
            >
              {f.url ? (
                <a href={f.url} target="_blank" rel="noopener noreferrer">
                  {f.file_name}
                </a>
              ) : (
                f.file_name
              )}
              <span style={{ color: "var(--muted)", marginLeft: 8, fontSize: 12 }}>
                {formatBytes(f.size_bytes)}
              </span>
            </span>
            <button
              onClick={() => remove(f)}
              disabled={busy}
              title="Löschen"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--danger)",
                cursor: "pointer",
                display: "inline-flex",
                flexShrink: 0,
              }}
            >
              <Icon name="trash" size={15} />
            </button>
          </div>
        ))}
        {files.length === 0 && (
          <p style={{ color: "var(--faint)", fontSize: 13, margin: 0 }}>
            Keine Dateien.
          </p>
        )}
      </div>

      <div style={{ marginTop: 10 }}>
        <input
          ref={inputRef}
          type="file"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
          style={{ fontSize: 13, color: "var(--muted)" }}
        />
        {err && (
          <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>
            {err}
          </div>
        )}
        <p style={{ color: "var(--faint)", fontSize: 11, marginTop: 4 }}>
          Max. 10 MB pro Datei.
        </p>
      </div>
    </section>
  );
}
