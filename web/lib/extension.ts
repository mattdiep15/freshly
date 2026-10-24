import type { Location, ShelfLife } from "./referenceMerge";

const DAY = 24 * 60 * 60 * 1000;
export const EXTENSION_DAYS = 2;

type FoodRanges = { fridgeDays?: ShelfLife; freezerDays?: ShelfLife; pantryDays?: ShelfLife };
const KEY: Record<Location, keyof FoodRanges> = { fridge: "fridgeDays", freezer: "freezerDays", pantry: "pantryDays" };

// Same fallback as p1-02's expiryFor: the location's range, else the fridge range.
export function sourcedRange(food: FoodRanges | null, location: Location): ShelfLife | null {
  if (!food) return null;
  return food[KEY[location]] ?? food.fridgeDays ?? null;
}

// "1-2 more days" on the second swipe card, capped at the high end of the sourced range.
export function extendExpiry({ purchasedAt, range, now }: { purchasedAt: number; range: Pick<ShelfLife, "max">; now: number }): number | null {
  const extended = Math.min(now + EXTENSION_DAYS * DAY, purchasedAt + range.max * DAY);
  return extended > now ? extended : null;
}
