import { describe, expect, test } from "vitest";
import { extendExpiry, sourcedRange } from "./extension";
import type { ShelfLife } from "./referenceMerge";

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.parse("2026-10-20T16:00:00Z");
const range = (min: number, max: number): ShelfLife => ({ min, max, source: "foodkeeper", ref: "test" });

describe("extendExpiry", () => {
  test("extends 2 days when the range allows it", () => {
    // Spinach, 3 to 7 days: expires day 3, high end day 7.
    expect(extendExpiry({ purchasedAt: T0, range: range(3, 7), now: T0 + 3 * DAY })).toBe(T0 + 5 * DAY);
  });

  test("caps at purchasedAt + range.max", () => {
    // Ground beef, FDA 1 to 2 days: bought day 0, expires day 1, extending on day 1 lands on day 2.
    expect(extendExpiry({ purchasedAt: T0, range: range(1, 2), now: T0 + DAY })).toBe(T0 + 2 * DAY);
  });

  test("returns null once the range is used up", () => {
    expect(extendExpiry({ purchasedAt: T0, range: range(1, 2), now: T0 + 2 * DAY })).toBeNull();
  });

  test("returns null when the card is swiped after the high end has passed", () => {
    expect(extendExpiry({ purchasedAt: T0, range: range(1, 2), now: T0 + 4 * DAY })).toBeNull();
  });
});

describe("sourcedRange", () => {
  const food = { fridgeDays: range(3, 7), freezerDays: range(60, 90) };

  test("uses the location's range", () => {
    expect(sourcedRange(food, "freezer")?.max).toBe(90);
  });

  test("falls back to the fridge range", () => {
    expect(sourcedRange(food, "pantry")?.max).toBe(7);
  });

  test("returns null with no food or no range", () => {
    expect(sourcedRange(null, "fridge")).toBeNull();
    expect(sourcedRange({ pantryDays: range(1, 2) }, "fridge")).toBeNull();
  });
});
