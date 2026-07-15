// Avatar bubbles for people (PM / Macher), monday-style.

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const a = parts[0][0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] ?? "");
  return (a + b).toUpperCase();
}

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 52% 52%)`;
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      title={name}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: colorFor(name),
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.4),
        fontWeight: 700,
        flexShrink: 0,
        boxShadow: "0 0 0 2px var(--surface)",
      }}
    >
      {initials(name)}
    </span>
  );
}

export function EmptyAvatar({ size = 28 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: "1.5px dashed var(--border)",
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}

export function AvatarStack({
  names,
  max = 3,
  size = 28,
}: {
  names: string[];
  max?: number;
  size?: number;
}) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      {shown.map((n, i) => (
        <span key={i} style={{ marginLeft: i === 0 ? 0 : -8 }}>
          <Avatar name={n} size={size} />
        </span>
      ))}
      {extra > 0 && (
        <span
          style={{
            marginLeft: -8,
            width: size,
            height: size,
            borderRadius: "50%",
            background: "var(--surface-2)",
            color: "var(--muted)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: Math.round(size * 0.36),
            fontWeight: 700,
            boxShadow: "0 0 0 2px var(--surface)",
          }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
