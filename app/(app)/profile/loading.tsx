export default function ProfileLoading() {
  return (
    <div className="page-pad" style={{ padding: "24px 28px", maxWidth: 620 }}>
      <div className="skeleton" style={{ height: 26, width: 160, marginBottom: 18 }} />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div className="skeleton" style={{ height: 16, width: 120, marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 38, width: "100%" }} />
        </div>
      ))}
    </div>
  );
}
