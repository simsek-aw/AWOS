export default function Home() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "64px 24px",
      }}
    >
      <h1 style={{ fontSize: 40, marginBottom: 8 }}>AWOS</h1>
      <p style={{ color: "var(--muted)", fontSize: 18, marginTop: 0 }}>
        Agency CMS — schlank, personalisiert, sicher isoliert.
      </p>

      <section style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 20 }}>Fundament steht</h2>
        <ul style={{ color: "var(--muted)" }}>
          <li>Datenmodell &amp; Row-Level-Security (siehe supabase/migrations)</li>
          <li>Getrennte interne ↔ Kunden-Objekte über task_links</li>
          <li>Supabase-Clients: Browser (anon) und Server (service role) getrennt</li>
        </ul>
        <p style={{ color: "var(--muted)" }}>
          Nächste Schritte: Auth-Flow, Board-Ansicht, Spiegelungs-Agent. Details
          in <code>docs/ARCHITECTURE.md</code> und <code>docs/SECURITY.md</code>.
        </p>
      </section>
    </main>
  );
}
