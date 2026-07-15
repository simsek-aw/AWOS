export default function AgentsLoading() {
  return (
    <div className="page-pad" style={{ padding: "24px 28px", maxWidth: 980 }}>
      <div className="skeleton" style={{ height: 26, width: 140, marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 14, width: 220, marginBottom: 24 }} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 16,
              display: "grid",
              gap: 10,
            }}
          >
            <div className="skeleton" style={{ height: 34, width: 34, borderRadius: 8 }} />
            <div className="skeleton" style={{ height: 15, width: "60%" }} />
            <div className="skeleton" style={{ height: 12, width: "90%" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
