"use client";

import { useEffect } from "react";

// Friendly error boundary for the app area. Shows a recoverable message instead
// of an opaque crash, with a retry.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: "app-error",
        message: error?.message,
        digest: error?.digest,
        url: typeof location !== "undefined" ? location.href : undefined,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "60vh",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 440,
          textAlign: "center",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 28,
        }}
      >
        <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Etwas ist schiefgelaufen</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0 }}>
          Die Seite konnte nicht geladen werden. Versuche es erneut – wenn es
          weiterhin auftritt, lade die Seite neu.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
          <button
            onClick={reset}
            style={{
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "9px 18px",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Erneut versuchen
          </button>
          <a
            href="/"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "9px 18px",
              fontWeight: 600,
              fontSize: 14,
              color: "var(--text)",
              textDecoration: "none",
            }}
          >
            Zur Startseite
          </a>
        </div>
      </div>
    </div>
  );
}
