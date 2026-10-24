import { describe, expect, test } from "vitest";
import { streakDays } from "./streak";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-10-24T16:00:00Z"); // 09:00 at UTC-7
const UTC_MINUS_7 = -420;

describe("streakDays", () => {
  test("no items gives 0", () => {
    expect(streakDays({ now: NOW, utcOffsetMinutes: 0 })).toBe(0);
  });

  test("no waste counts from the first item", () => {
    expect(streakDays({ firstItemAt: NOW - 12 * DAY, now: NOW, utcOffsetMinutes: 0 })).toBe(12);
  });

  test("a wasted item resets the count", () => {
    expect(streakDays({ firstItemAt: NOW - 12 * DAY, lastWasteAt: NOW - 4 * DAY, now: NOW, utcOffsetMinutes: 0 })).toBe(4);
  });

  test("a pending swipe expiring today resets it to 0", () => {
    expect(streakDays({ firstItemAt: NOW - 12 * DAY, lastWasteAt: NOW - 2 * 60 * 60 * 1000, now: NOW, utcOffsetMinutes: 0 })).toBe(0);
  });

  test("counts local days at UTC-7", () => {
    // 23:30 local on Oct 22 is 06:30 UTC on Oct 23, but it still counts as Oct 22.
    const toss = Date.parse("2026-10-23T06:30:00Z");
    expect(streakDays({ firstItemAt: NOW - 12 * DAY, lastWasteAt: toss, now: NOW, utcOffsetMinutes: UTC_MINUS_7 })).toBe(2);
    expect(streakDays({ firstItemAt: NOW - 12 * DAY, lastWasteAt: toss, now: NOW, utcOffsetMinutes: 0 })).toBe(1);
  });
});
