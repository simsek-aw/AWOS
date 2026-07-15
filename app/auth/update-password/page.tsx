import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { setPassword } from "./actions";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Reachable only after the invite/recovery link established a session.
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          background: "var(--panel)",
          borderRadius: 12,
          padding: 32,
        }}
      >
        <h1 style={{ marginTop: 0, fontSize: 24 }}>Willkommen bei AWOS</h1>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          Lege ein Passwort für <strong>{ctx.email}</strong> fest.
        </p>

        {error && (
          <p
            role="alert"
            style={{
              background: "var(--danger-bg)",
              color: "var(--danger)",
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            {error}
          </p>
        )}

        <form action={setPassword} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
            Neues Passwort (min. 8 Zeichen)
            <input
              type="password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 12px",
                color: "var(--text)",
                fontSize: 15,
              }}
            />
          </label>
          <button
            type="submit"
            style={{
              marginTop: 8,
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "11px 12px",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Passwort speichern & loslegen
          </button>
        </form>
      </div>
    </main>
  );
}
