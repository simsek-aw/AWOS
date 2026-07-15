export default function NotificationsLoading() {
  return (
    <div className="page-pad" style={{ padding: "24px 28px", maxWidth: 720 }}>
      <div className="skeleton" style={{ height: 26, width: 220, marginBottom: 18 }} />
      <div style={{ display: "grid", gap: 8 }}>
        {[0, 1, 2, 3, 4, 5].map((r) => (
          <div
            key={r}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "12px 14px",
              display: "grid",
              gap: 6,
            }}
          >
            <div className="skeleton" style={{ height: 14, width: "70%" }} />
            <div className="skeleton" style={{ height: 11, width: 90 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
