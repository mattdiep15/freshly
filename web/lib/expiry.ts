import type { Location, ShelfLife, ShelfLifeSource } from "./referenceMerge";

const DAY = 24 * 60 * 60 * 1000;

type FoodRanges = { fridgeDays?: ShelfLife; freezerDays?: ShelfLife; pantryDays?: ShelfLife };

const KEY: Record<Location, keyof FoodRanges> = { fridge: "fridgeDays", freezer: "freezerDays", pantry: "pantryDays" };

// Uses the low end of the sourced range, since shelf life is a safety claim; null means "ask the user".
export function expiryFor(
  food: FoodRanges | null,
  location: Location,
  purchasedAt: number,
): { expiresAt: number; expirySource: ShelfLifeSource } | null {
  if (!food) return null;
  const range = food[KEY[location]] ?? food.fridgeDays;
  if (!range) return null;
  return { expiresAt: purchasedAt + range.min * DAY, expirySource: range.source };
}
