import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          background: "var(--panel)",
          borderRadius: 12,
          padding: 32,
        }}
      >
        <h1 style={{ marginTop: 0, fontSize: 28 }}>AWOS</h1>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>Anmelden</p>

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

        <form action={login} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
            E-Mail
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
            Passwort
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              style={inputStyle}
            />
          </label>
          <button type="submit" style={buttonStyle}>
            Anmelden
          </button>
        </form>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--input-bg)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "10px 12px",
  color: "var(--text)",
  fontSize: 15,
};

const buttonStyle: React.CSSProperties = {
  marginTop: 8,
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "11px 12px",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};
