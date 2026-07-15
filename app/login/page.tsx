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
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 32,
          boxShadow: "var(--shadow)",
        }}
      >
        <h1 style={{ marginTop: 0, fontSize: 28 }}>AWOS</h1>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          Bitte melde dich an.
        </p>
        <AuthBox />
      </div>
    </main>
  );
}
