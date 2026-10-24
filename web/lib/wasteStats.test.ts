import { describe, expect, test } from "vitest";
import { summarizeWaste, type ResolvedItem } from "./wasteStats";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-10-24T16:00:00Z");

function resolved(daysAgo: number, fields: Omit<ResolvedItem, "resolvedAt">): ResolvedItem {
  return { resolvedAt: NOW - daysAgo * DAY, ...fields };
}

describe("summarizeWaste", () => {
  const items = [
    resolved(1, { status: "wasted", fractionWasted: 1, priceCents: 400, weightGrams: 453.6 }),
    resolved(3, { status: "used", fractionWasted: 0, priceCents: 1000, weightGrams: 1000 }),
    resolved(10, { status: "wasted", fractionWasted: 1, priceCents: 200, weightGrams: 100 }),
    resolved(40, { status: "used", fractionWasted: 0, priceCents: 300, weightGrams: 300 }),
  ];

  test("filters by range", () => {
    expect(summarizeWaste(items, "week", NOW)).toMatchObject({ itemsUsed: 1, itemsWasted: 1, usedRate: 0.5, wastedCents: 400 });
    expect(summarizeWaste(items, "month", NOW)).toMatchObject({ itemsUsed: 1, itemsWasted: 2, wastedCents: 600 });
    expect(summarizeWaste(items, "all", NOW)).toMatchObject({ itemsUsed: 2, itemsWasted: 2, usedRate: 0.5 });
  });

  test("converts grams to pounds", () => {
    expect(summarizeWaste(items, "week", NOW)).toMatchObject({ wastedGrams: 454, wastedLbs: 1 });
  });

  test("weights money and mass by fractionWasted", () => {
    const half = [resolved(1, { status: "wasted", fractionWasted: 0.5, priceCents: 599, weightGrams: 907 })];
    expect(summarizeWaste(half, "week", NOW)).toMatchObject({ itemsWasted: 1, wastedCents: 300, wastedGrams: 454 });
  });

  test("a missing fractionWasted follows the status", () => {
    const summary = summarizeWaste(
      [resolved(1, { status: "wasted", priceCents: 100 }), resolved(1, { status: "used", priceCents: 900 })],
      "week",
      NOW,
    );
    expect(summary.wastedCents).toBe(100);
  });

  test("items missing price or weight count toward totals but not sums", () => {
    const summary = summarizeWaste(
      [
        resolved(1, { status: "wasted", fractionWasted: 1, weightGrams: 200 }),
        resolved(1, { status: "wasted", fractionWasted: 1, priceCents: 250 }),
        resolved(1, { status: "used", fractionWasted: 0 }),
      ],
      "week",
      NOW,
    );
    expect(summary).toMatchObject({
      itemsUsed: 1,
      itemsWasted: 2,
      wastedCents: 250,
      wastedGrams: 200,
      itemsMissingPrice: 1,
      itemsMissingWeight: 1,
    });
  });

  test("no resolved items gives zeros and a null rate", () => {
    expect(summarizeWaste([], "all", NOW)).toEqual({
      range: "all",
      itemsUsed: 0,
      itemsWasted: 0,
      usedRate: null,
      wastedCents: 0,
      wastedGrams: 0,
      wastedLbs: 0,
      itemsMissingPrice: 0,
      itemsMissingWeight: 0,
    });
  });
});
