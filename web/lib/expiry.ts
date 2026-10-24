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

// Freezing stops spoilage but does not undo it: a passed date stays, and the freezer range counts from the move.
export function expiryAfterMove(
  food: FoodRanges | null,
  to: Location,
  item: { purchasedAt: number; expiresAt?: number; expirySource?: ShelfLifeSource | "user" },
  now: number,
): { expiresAt: number; expirySource?: ShelfLifeSource | "user" } | null {
  if (item.expiresAt !== undefined && item.expiresAt <= now) {
    return { expiresAt: item.expiresAt, expirySource: item.expirySource };
  }
  const startsAt = to === "freezer" && food?.freezerDays ? now : item.purchasedAt;
  return expiryFor(food, to, startsAt);
}

// Processed foods carry a printed date that beats our estimate; ask for it until the user has set one.
export function needsLabelDate(
  food: { hasPrintedDate?: boolean } | null,
  expirySource: ShelfLifeSource | "user" | undefined,
): boolean {
  return food?.hasPrintedDate === true && expirySource !== "user";
}
