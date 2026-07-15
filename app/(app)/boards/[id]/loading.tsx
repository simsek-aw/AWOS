// Skeleton shown while a board page streams in.
export default function BoardLoading() {
  return (
    <div className="page-pad" style={{ padding: "24px 28px" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div className="skeleton" style={{ height: 34, width: 130, borderRadius: 8 }} />
        <div style={{ flex: 1 }} />
        <div className="skeleton" style={{ height: 34, width: 90, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 34, width: 90, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 34, width: 90, borderRadius: 8 }} />
      </div>

      {/* Two group cards */}
      {[0, 1].map((g) => (
        <div key={g} style={{ marginBottom: 28 }}>
          <div className="skeleton" style={{ height: 20, width: 180, marginBottom: 12 }} />
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            {[0, 1, 2, 3].map((r) => (
              <div
                key={r}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "12px 16px",
                  borderBottom: r < 3 ? "1px solid var(--border)" : "none",
                }}
              >
                <div className="skeleton" style={{ height: 14, width: 60 }} />
                <div className="skeleton" style={{ height: 14, flex: 1, maxWidth: 260 }} />
                <div className="skeleton" style={{ height: 24, width: 24, borderRadius: "50%" }} />
                <div className="skeleton" style={{ height: 24, width: 24, borderRadius: "50%" }} />
                <div className="skeleton" style={{ height: 14, width: 90 }} />
                <div className="skeleton" style={{ height: 24, width: 90, borderRadius: 12 }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
