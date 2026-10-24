import { describe, expect, test } from "vitest";
import { periodStart, summarizeWaste, type ResolvedItem } from "./wasteStats";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-10-24T16:00:00Z"); // a Saturday

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
    expect(summarizeWaste(items, "week", NOW, 0)).toMatchObject({ itemsUsed: 1, itemsWasted: 1, usedRate: 0.5, wastedCents: 400 });
    expect(summarizeWaste(items, "month", NOW, 0)).toMatchObject({ itemsUsed: 1, itemsWasted: 2, wastedCents: 600 });
    expect(summarizeWaste(items, "all", NOW, 0)).toMatchObject({ itemsUsed: 2, itemsWasted: 2, usedRate: 0.5 });
  });

  test("converts grams to pounds", () => {
    expect(summarizeWaste(items, "week", NOW, 0)).toMatchObject({ wastedGrams: 454, wastedLbs: 1 });
  });

  test("weights money and mass by fractionWasted", () => {
    const half = [resolved(1, { status: "wasted", fractionWasted: 0.5, priceCents: 599, weightGrams: 907 })];
    expect(summarizeWaste(half, "week", NOW, 0)).toMatchObject({ itemsWasted: 1, wastedCents: 300, wastedGrams: 454 });
  });

  test("a missing fractionWasted follows the status, with wasted counting as half", () => {
    const summary = summarizeWaste(
      [resolved(1, { status: "wasted", priceCents: 100 }), resolved(1, { status: "used", priceCents: 900 })],
      "week",
      NOW,
      0,
    );
    expect(summary.wastedCents).toBe(50);
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
      0,
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
    expect(summarizeWaste([], "all", NOW, 0)).toEqual({
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

describe("periodStart", () => {
  test("weeks start Monday at local midnight", () => {
    expect(periodStart("week", NOW, 0)).toBe(Date.parse("2026-10-19T00:00:00Z"));
    expect(periodStart("week", NOW, -420)).toBe(Date.parse("2026-10-19T07:00:00Z"));
  });

  test("a Monday starts its own week", () => {
    const monday = Date.parse("2026-10-19T08:00:00Z");
    expect(periodStart("week", monday, -420)).toBe(Date.parse("2026-10-19T07:00:00Z"));
  });

  test("local time decides the day: Monday 03:00 UTC is still Sunday at UTC-7", () => {
    expect(periodStart("week", Date.parse("2026-10-19T03:00:00Z"), -420)).toBe(Date.parse("2026-10-12T07:00:00Z"));
  });

  test("months start on the 1st at local midnight", () => {
    expect(periodStart("month", NOW, -420)).toBe(Date.parse("2026-10-01T07:00:00Z"));
    expect(periodStart("all", NOW, -420)).toBe(-Infinity);
  });

  test("a toss on Sunday night local falls in the previous week", () => {
    const sundayNight = Date.parse("2026-10-19T06:30:00Z"); // 23:30 Sunday at UTC-7
    const items: ResolvedItem[] = [{ status: "wasted", resolvedAt: sundayNight, fractionWasted: 1, priceCents: 100 }];
    expect(summarizeWaste(items, "week", NOW, -420).itemsWasted).toBe(0);
    expect(summarizeWaste(items, "week", NOW, 0).itemsWasted).toBe(1);
  });
});
