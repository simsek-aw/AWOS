// Small, pure formatting helpers shared by server and client components.

/** ISO date (YYYY-MM-DD…) → TT.MM.JJJJ. Passes anything unparseable through. */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** Whole days from today until an ISO date (negative = in the past). */
export function daysUntil(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Urgency badge for a deadline: red once it's due within a day (or overdue),
 * amber at 2–3 days out, nothing beyond that.
 */
export function deadlineUrgency(
  iso: string,
): { label: string; tone: "red" | "amber" } | null {
  const d = daysUntil(iso);
  if (d == null) return null;
  if (d < 0)
    return {
      label: d === -1 ? "1 Tag überfällig" : `${Math.abs(d)} Tage überfällig`,
      tone: "red",
    };
  if (d === 0) return { label: "Heute fällig", tone: "red" };
  if (d === 1) return { label: "Noch 1 Tag", tone: "red" };
  if (d <= 3) return { label: `Noch ${d} Tage`, tone: "amber" };
  return null;
}
