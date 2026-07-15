export default function PersonLoading() {
  return (
    <div className="page-pad" style={{ padding: "24px 28px", maxWidth: 880 }}>
      <div className="skeleton" style={{ height: 26, width: 220, marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 14, width: 180, marginBottom: 18 }} />
      <div style={{ display: "grid", gap: 8 }}>
        {[0, 1, 2, 3, 4].map((r) => (
          <div
            key={r}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "12px 14px",
            }}
          >
            <div style={{ display: "grid", gap: 6, flex: 1 }}>
              <div className="skeleton" style={{ height: 14, width: "45%" }} />
              <div className="skeleton" style={{ height: 11, width: 100 }} />
            </div>
            <div className="skeleton" style={{ height: 22, width: 70, borderRadius: 999 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
