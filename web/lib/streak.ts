import { localDayNumber } from "./digest";

export type StreakInputs = {
  lastWasteAt?: number; // latest toss or unswiped expiry
  firstItemAt?: number; // earliest purchase; absent when the user has no items
  now: number;
  utcOffsetMinutes: number;
};

// Local calendar days without waste, so a weekly shopper keeps a streak between trips.
export function streakDays({ lastWasteAt, firstItemAt, now, utcOffsetMinutes }: StreakInputs): number {
  const since = lastWasteAt ?? firstItemAt;
  if (since === undefined) return 0;
  return Math.max(0, localDayNumber(now, utcOffsetMinutes) - localDayNumber(since, utcOffsetMinutes));
}
