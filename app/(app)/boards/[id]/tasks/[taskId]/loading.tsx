// Skeleton shown while the full task view streams in.
export default function TaskLoading() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px" }}>
      <div className="skeleton" style={{ height: 14, width: 120, marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 12, width: 90, marginBottom: 16 }} />

      {/* Title */}
      <div className="skeleton" style={{ height: 26, width: "60%", marginBottom: 16 }} />

      {/* 2×2 field grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 14,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ display: "grid", gap: 6 }}>
            <div className="skeleton" style={{ height: 10, width: 60 }} />
            <div className="skeleton" style={{ height: 20, width: "80%" }} />
          </div>
        ))}
      </div>

      {/* Output */}
      <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
        <div className="skeleton" style={{ height: 10, width: 60 }} />
        <div className="skeleton" style={{ height: 20, width: "70%" }} />
      </div>

      {/* Updates */}
      <div style={{ marginTop: 32 }}>
        <div className="skeleton" style={{ height: 18, width: 120, marginBottom: 14 }} />
        <div className="skeleton" style={{ height: 80, width: "100%", marginBottom: 16, borderRadius: 10 }} />
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div className="skeleton" style={{ height: 32, width: 32, borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1, display: "grid", gap: 6 }}>
              <div className="skeleton" style={{ height: 12, width: 140 }} />
              <div className="skeleton" style={{ height: 12, width: "90%" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
