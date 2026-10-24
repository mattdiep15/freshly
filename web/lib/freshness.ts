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

export function expiredLabel(expiresAt: number, now: number): string {
  return `expired ${daysAgoLabel(expiresAt, now)}`;
}

// "today", "3 days", or "2 days ago" beside a status tag; null for an undated item, whose tag already says so.
export function statusTiming(expiresAt: number | undefined, now: number): string | null {
  if (expiresAt === undefined) return null;
  return expiresAt <= now ? daysAgoLabel(expiresAt, now) : daysLeftLabel(expiresAt, now);
}

// A picked calendar date means "good through that day", so it expires at the end of it.
export function endOfLocalDay(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59).getTime();
}

// The YYYY-MM-DD value an <input type="date"> expects, in local time.
export function dateInputValue(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// The date `days` after a YYYY-MM-DD date, in the same format.
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return dateInputValue(new Date(y, m - 1, d + days, 12).getTime());
}

// A past purchase day as a timestamp; noon keeps it on that day across DST shifts.
export function localNoon(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 12).getTime();
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
