"use client";

import { useEffect } from "react";

// Root-level error boundary. Unlike app/(app)/error.tsx (which lives *inside*
// the app layout and can't catch errors thrown by the layout itself), this
// catches crashes at the very top — including the app shell — so the user never
// sees the raw Next.js error screen. Must render its own <html>/<body>.
export default function GlobalError({
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
        context: "global-error",
        message: error?.message,
        digest: error?.digest,
        url: typeof location !== "undefined" ? location.href : undefined,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0f1117",
          color: "#e6e8ee",
        }}
      >
        <div
          style={{
            maxWidth: 460,
            textAlign: "center",
            border: "1px solid #2a2f3a",
            borderRadius: 12,
            padding: 28,
            background: "#161a22",
          }}
        >
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>
            Etwas ist schiefgelaufen
          </h1>
          <p style={{ color: "#9aa1b1", fontSize: 14, marginTop: 0 }}>
            Die Seite konnte nicht geladen werden. Versuche es erneut oder lade
            die Seite neu.
          </p>
          {error?.digest && (
            <p style={{ color: "#6b7280", fontSize: 12, marginTop: 8 }}>
              Fehler-Code: <code>{error.digest}</code>
            </p>
          )}
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
              marginTop: 16,
            }}
          >
            <button
              onClick={reset}
              style={{
                background: "#4b7bec",
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
                background: "#222836",
                border: "1px solid #2a2f3a",
                borderRadius: 8,
                padding: "9px 18px",
                fontWeight: 600,
                fontSize: 14,
                color: "#e6e8ee",
                textDecoration: "none",
              }}
            >
              Zur Startseite
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
