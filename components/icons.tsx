// Flat line icons (Feather/Lucide-style, MIT shapes) as inline SVG.
// stroke = currentColor, so an icon takes the surrounding text colour (white on
// the dark chrome). CSP-safe (inline SVG, no external requests, no font).

export type IconName =
  | "menu"
  | "bell"
  | "message"
  | "sparkles"
  | "more"
  | "plus"
  | "chevron-down"
  | "chevron-right"
  | "chevron-left"
  | "search"
  | "user"
  | "filter"
  | "sort"
  | "eye-off"
  | "x"
  | "reply"
  | "like"
  | "open"
  | "external"
  | "link"
  | "arrow-right"
  | "copy"
  | "trash"
  | "check"
  | "group";

const PATHS: Record<IconName, React.ReactNode> = {
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  message: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  sparkles: (
    <path d="M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2z" />
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  "chevron-down": <path d="M6 9l6 6 6-6" />,
  "chevron-right": <path d="M9 6l6 6-6 6" />,
  "chevron-left": <path d="M15 6l-6 6 6 6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  user: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  filter: <path d="M22 3H2l8 9.46V19l4 2v-8.54z" />,
  sort: (
    <>
      <path d="M7 4v16M3 8l4-4 4 4" />
      <path d="M17 20V4M21 16l-4 4-4-4" />
    </>
  ),
  "eye-off": (
    <>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24M1 1l22 22" />
    </>
  ),
  x: <path d="M18 6L6 18M6 6l12 12" />,
  reply: (
    <>
      <path d="M9 17l-5-5 5-5" />
      <path d="M4 12h11a4 4 0 0 1 4 4v2" />
    </>
  ),
  like: (
    <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm0 0l4-8a2 2 0 0 1 2 2v4h6a2 2 0 0 1 2 2.3l-1.4 8a2 2 0 0 1-2 1.7H7" />
  ),
  open: <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />,
  external: (
    <>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6M10 14L21 3" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </>
  ),
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  trash: (
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  ),
  check: <path d="M20 6L9 17l-5-5" />,
  group: (
    <>
      <rect x="3" y="4" width="18" height="6" rx="1" />
      <rect x="3" y="14" width="18" height="6" rx="1" />
    </>
  ),
};

export default function Icon({
  name,
  size = 18,
  strokeWidth = 2,
  style,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
