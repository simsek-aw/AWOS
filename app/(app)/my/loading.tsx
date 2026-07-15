// Skeleton shown while "Meine Aufgaben" streams in.
export default function MyTasksLoading() {
  return (
    <div className="page-pad" style={{ padding: "24px 28px", maxWidth: 880 }}>
      <div className="skeleton" style={{ height: 26, width: 200, marginBottom: 18 }} />
      <div style={{ display: "grid", gap: 8 }}>
        {[0, 1, 2, 3, 4].map((r) => (
          <div
            key={r}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "12px 14px",
            }}
          >
            <div style={{ display: "grid", gap: 6, flex: 1 }}>
              <div className="skeleton" style={{ height: 14, width: "45%" }} />
              <div className="skeleton" style={{ height: 11, width: 100 }} />
            </div>
            <div className="skeleton" style={{ height: 13, width: 70 }} />
            <div className="skeleton" style={{ height: 13, width: 80 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
