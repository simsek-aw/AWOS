import AuthBox from "@/components/AuthBox";

// The Auth UI needs the runtime Supabase env; don't prerender at build time.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        // Subtle branded glow behind the card.
        background:
          "radial-gradient(1100px 520px at 50% -10%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%), var(--bg)",
      }}
    >
      <div
        className="page-enter"
        style={{
          width: "100%",
          maxWidth: 400,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 32,
          boxShadow: "var(--shadow)",
        }}
      >
        <img
          src="/logo.svg"
          alt="AWOS"
          style={{ height: 30, width: "auto", display: "block", marginBottom: 18 }}
        />
        <h1 style={{ marginTop: 0, marginBottom: 4, fontSize: 22 }}>Willkommen zurück</h1>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          Bitte melde dich an.
        </p>
        <AuthBox />
      </div>
    </main>
  );
}
