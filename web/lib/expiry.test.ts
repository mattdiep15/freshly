import { describe, expect, test } from "vitest";
import { expiryAfterMove, expiryFor, needsLabelDate } from "./expiry";

const DAY = 24 * 60 * 60 * 1000;
const bought = Date.UTC(2026, 9, 6);

const groundBeef = {
  fridgeDays: { min: 1, max: 2, source: "fda_chart" as const, ref: "FDA chart 2018-03 > Hamburger > Ground beef" },
  freezerDays: { min: 90, max: 120, source: "fda_chart" as const, ref: "FDA chart 2018-03 > Hamburger > Ground beef" },
};
const spinach = {
  fridgeDays: { min: 3, max: 7, source: "foodkeeper" as const, ref: "FoodKeeper v128 > #291" },
};

describe("expiryFor", () => {
  test("uses the fridge range for the fridge", () => {
    expect(expiryFor(groundBeef, "fridge", bought)).toEqual({ expiresAt: bought + 1 * DAY, expirySource: "fda_chart" });
  });

  test("uses the freezer range for the freezer", () => {
    expect(expiryFor(groundBeef, "freezer", bought)?.expiresAt).toBe(bought + 90 * DAY);
  });

  test("falls back to the fridge range when the location has none", () => {
    expect(expiryFor(spinach, "pantry", bought)).toEqual({ expiresAt: bought + 3 * DAY, expirySource: "foodkeeper" });
  });

  test("returns null with no sourced range or no food", () => {
    expect(expiryFor({}, "fridge", bought)).toBeNull();
    expect(expiryFor({ freezerDays: groundBeef.freezerDays }, "fridge", bought)).toBeNull();
    expect(expiryFor(null, "fridge", bought)).toBeNull();
  });

  test("uses the low end of the range", () => {
    const wide = { fridgeDays: { min: 3, max: 5, source: "fda_chart" as const, ref: "x" } };
    expect(expiryFor(wide, "fridge", bought)?.expiresAt).toBe(bought + 3 * DAY);
  });
});

describe("expiryAfterMove", () => {
  const inFridge = { purchasedAt: bought, expiresAt: bought + 1 * DAY, expirySource: "fda_chart" as const };

  test("keeps a date that has passed instead of giving it a freezer date", () => {
    const now = bought + 3 * DAY;
    expect(expiryAfterMove(groundBeef, "freezer", inFridge, now)).toEqual({ expiresAt: bought + 1 * DAY, expirySource: "fda_chart" });
  });

  test("keeps a passed date the user set", () => {
    const item = { purchasedAt: bought, expiresAt: bought + 2 * DAY, expirySource: "user" as const };
    expect(expiryAfterMove(groundBeef, "freezer", item, bought + 3 * DAY)).toEqual({ expiresAt: bought + 2 * DAY, expirySource: "user" });
  });

  test("counts the freezer range from the move, not the purchase", () => {
    const now = bought + 0.5 * DAY;
    expect(expiryAfterMove(groundBeef, "freezer", inFridge, now)).toEqual({ expiresAt: now + 90 * DAY, expirySource: "fda_chart" });
  });

  test("counts from the purchase when the food has no freezer range", () => {
    const item = { purchasedAt: bought, expiresAt: bought + 3 * DAY, expirySource: "foodkeeper" as const };
    expect(expiryAfterMove(spinach, "freezer", item, bought + 2 * DAY)?.expiresAt).toBe(bought + 3 * DAY);
  });

  test("dates an undated item moved to the freezer from the move", () => {
    const now = bought + 1 * DAY;
    expect(expiryAfterMove(groundBeef, "freezer", { purchasedAt: bought }, now)?.expiresAt).toBe(now + 90 * DAY);
  });

  test("recomputes other moves from the purchase", () => {
    const frozen = { purchasedAt: bought, expiresAt: bought + 90 * DAY, expirySource: "fda_chart" as const };
    expect(expiryAfterMove(groundBeef, "fridge", frozen, bought + 10 * DAY)?.expiresAt).toBe(bought + 1 * DAY);
  });
});

describe("needsLabelDate", () => {
  test("flags a processed food until the user sets a date", () => {
    expect(needsLabelDate({ hasPrintedDate: true }, "foodkeeper")).toBe(true);
    expect(needsLabelDate({ hasPrintedDate: true }, undefined)).toBe(true);
    expect(needsLabelDate({ hasPrintedDate: true }, "user")).toBe(false);
  });

  test("does not flag fresh, unclassified, or unknown foods", () => {
    expect(needsLabelDate({ hasPrintedDate: false }, "fda_chart")).toBe(false);
    expect(needsLabelDate({}, "foodkeeper")).toBe(false);
    expect(needsLabelDate(null, undefined)).toBe(false);
  });
});
