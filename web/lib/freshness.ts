const DAY_MS = 24 * 60 * 60 * 1000;

// Matches the 3-day reminder ping in docs/PRODUCT.md.
export const USE_SOON_DAYS = 3;

export type Freshness = "fresh" | "soon" | "expired" | "unknown";

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Calendar days in local time; rounding absorbs 23h and 25h DST days.
export function daysUntil(expiresAt: number, now: number): number {
  return Math.round((startOfDay(expiresAt) - startOfDay(now)) / DAY_MS);
}

export function freshness(expiresAt: number | undefined, now: number): Freshness {
  if (expiresAt === undefined) return "unknown";
  if (expiresAt <= now) return "expired";
  return daysUntil(expiresAt, now) <= USE_SOON_DAYS ? "soon" : "fresh";
}

export function daysLeftLabel(expiresAt: number | undefined, now: number): string {
  if (expiresAt === undefined) return "no date";
  if (expiresAt <= now) return "expired";
  const days = daysUntil(expiresAt, now);
  if (days === 0) return "today";
  return days === 1 ? "1 day" : `${days} days`;
}

// "today", "1 day ago", "3 days ago" for an item past its date.
export function daysAgoLabel(expiresAt: number, now: number): string {
  const days = -daysUntil(expiresAt, now);
  if (days <= 0) return "today";
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

const URGENCY_RANK: Record<Freshness, number> = { expired: 0, soon: 1, fresh: 2, unknown: 3 };

// Expired items lead so the swipe check-in is the first thing the user sees.
export function sortByUrgency<T extends { expiresAt?: number }>(items: T[], now: number): T[] {
  return [...items].sort(
    (a, b) =>
      URGENCY_RANK[freshness(a.expiresAt, now)] - URGENCY_RANK[freshness(b.expiresAt, now)] ||
      (a.expiresAt ?? 0) - (b.expiresAt ?? 0),
  );
}

export function pickUseSoon<T extends { expiresAt?: number }>(items: T[], now: number, limit = 3): T[] {
  return sortByUrgency(items, now)
    .filter((item) => freshness(item.expiresAt, now) === "soon")
    .slice(0, limit);
}

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

export function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}
