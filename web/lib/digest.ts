const DAY = 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;

export const REMINDER_DAYS = [1, 3, 7] as const;
const UNDATED_NUDGE_EVERY_DAYS = 7;

export type DigestItem<Id extends string = string> = { _id: Id; name: string; expiresAt: number };
export type Digest<Id extends string = string> = {
  title: string;
  body: string;
  itemIds: Id[];
  undatedCount?: number; // set only when this digest nudged about undated items
};

// Days since the epoch in the user's local calendar.
export function localDayNumber(ms: number, utcOffsetMinutes: number): number {
  return Math.floor((ms + utcOffsetMinutes * MINUTE) / DAY);
}

// Local calendar days until expiry: 0 is today, 1 is tomorrow, negative is past.
export function daysLeft(expiresAt: number, now: number, utcOffsetMinutes: number): number {
  return localDayNumber(expiresAt, utcOffsetMinutes) - localDayNumber(now, utcOffsetMinutes);
}

// "2026-10-24" for the user's local date.
export function localDateKey(ms: number, utcOffsetMinutes: number): string {
  return new Date(localDayNumber(ms, utcOffsetMinutes) * DAY).toISOString().slice(0, 10);
}

export function isDigestDue(now: number, utcOffsetMinutes: number, digestHour: number): boolean {
  const localMs = now + utcOffsetMinutes * MINUTE;
  return new Date(localMs).getUTCHours() === digestHour;
}

function daysBetweenKeys(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY);
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

const DAY_LABEL: Record<(typeof REMINDER_DAYS)[number], string> = {
  1: "Expiring tomorrow",
  3: "In 3 days",
  7: "In a week",
};

export function buildDigest<Id extends string>(
  items: DigestItem<Id>[],
  pendingReviews: number,
  undatedCount: number,
  now: number,
  utcOffsetMinutes: number,
  lastUndatedNudgeDateKey?: string,
): Digest<Id> | null {
  const today = localDateKey(now, utcOffsetMinutes);
  const due = REMINDER_DAYS.map((d) => ({
    days: d,
    items: items
      .filter((i) => daysLeft(i.expiresAt, now, utcOffsetMinutes) === d)
      .sort((a, b) => a.expiresAt - b.expiresAt),
  })).filter((g) => g.items.length > 0);
  const nudgeUndated =
    undatedCount > 0 &&
    (lastUndatedNudgeDateKey === undefined ||
      daysBetweenKeys(lastUndatedNudgeDateKey, today) >= UNDATED_NUDGE_EVERY_DAYS);

  const reminderCount = due.reduce((n, g) => n + g.items.length, 0);
  if (reminderCount === 0 && pendingReviews === 0 && !nudgeUndated) return null;

  const sentences = due.map((g) => `${DAY_LABEL[g.days]}: ${joinNames(g.items.map((i) => i.name))}.`);
  if (pendingReviews > 0) sentences.push(`${plural(pendingReviews, "item")} need${pendingReviews === 1 ? "s" : ""} a swipe.`);
  if (nudgeUndated) sentences.push(`${plural(undatedCount, "item")} ${undatedCount === 1 ? "has" : "have"} no date yet.`);

  const title =
    reminderCount > 0
      ? `${plural(reminderCount, "thing")} to use soon`
      : pendingReviews > 0
        ? `${plural(pendingReviews, "item")} need${pendingReviews === 1 ? "s" : ""} a swipe`
        : `${plural(undatedCount, "item")} need${undatedCount === 1 ? "s" : ""} a date`;

  return {
    title,
    body: sentences.join(" "),
    itemIds: due.flatMap((g) => g.items.map((i) => i._id)),
    ...(nudgeUndated ? { undatedCount } : {}),
  };
}
