import { describe, expect, test } from "vitest";
import { buildDigest, daysLeft, isDigestDue, localDateKey, type DigestItem } from "./digest";

const DAY = 24 * 60 * 60 * 1000;
const PDT = -420;
// 2026-10-24 09:00 local at UTC-7.
const NOW = Date.parse("2026-10-24T16:00:00Z");

function item(name: string, days: number): DigestItem {
  return { _id: name, name, expiresAt: NOW + days * DAY };
}

describe("daysLeft", () => {
  test("counts local calendar days, not 24h blocks", () => {
    // 23:30 local on the 24th is still today.
    expect(daysLeft(Date.parse("2026-10-25T06:30:00Z"), NOW, PDT)).toBe(0);
    // 00:30 local on the 25th is tomorrow.
    expect(daysLeft(Date.parse("2026-10-25T07:30:00Z"), NOW, PDT)).toBe(1);
    expect(daysLeft(NOW - DAY, NOW, PDT)).toBe(-1);
  });

  test("localDateKey uses the local date", () => {
    expect(localDateKey(Date.parse("2026-10-25T03:00:00Z"), PDT)).toBe("2026-10-24");
    expect(localDateKey(Date.parse("2026-10-25T03:00:00Z"), 0)).toBe("2026-10-25");
  });
});

describe("isDigestDue", () => {
  test("a user at UTC-7 with digestHour 9 is due at 16:00 UTC", () => {
    expect(isDigestDue(Date.parse("2026-10-24T16:00:00Z"), PDT, 9)).toBe(true);
    expect(isDigestDue(Date.parse("2026-10-24T16:59:00Z"), PDT, 9)).toBe(true);
    expect(isDigestDue(Date.parse("2026-10-24T09:00:00Z"), PDT, 9)).toBe(false);
    expect(isDigestDue(Date.parse("2026-10-24T17:00:00Z"), PDT, 9)).toBe(false);
  });
});

describe("buildDigest", () => {
  test("includes items at exactly 7, 3, and 1 days and no others", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 0].map((d) => item(`d${d}`, d));
    const digest = buildDigest(items, 0, 0, NOW, PDT);
    expect(digest?.itemIds).toEqual(["d1", "d3", "d7"]);
    expect(digest?.title).toBe("3 things to use soon");
    expect(digest?.body).toBe("Expiring tomorrow: d1.\nIn 3 days: d3.\nIn a week: d7.");
  });

  test("an item bought with 3 days of shelf life gets the 3 and 1 day reminders only", () => {
    const bought = NOW;
    const milk = { _id: "m", name: "Milk", expiresAt: bought + 3 * DAY };
    const reminded = [0, 1, 2, 3].filter((day) => buildDigest([milk], 0, 0, bought + day * DAY, PDT) !== null);
    expect(reminded).toEqual([0, 2]);
    expect(buildDigest([milk], 0, 0, bought, PDT)?.body).toBe("In 3 days: Milk.");
    expect(buildDigest([milk], 0, 0, bought + 2 * DAY, PDT)?.body).toBe("Expiring tomorrow: Milk.");
  });

  test("groups same-day items into one sentence", () => {
    const digest = buildDigest([item("Spinach", 1), item("Ground beef", 1), item("Eggs", 3)], 2, 0, NOW, PDT);
    expect(digest).toEqual({
      title: "3 things to use soon",
      body: "Expiring tomorrow: Spinach and Ground beef.\nIn 3 days: Eggs.\n2 items need a swipe.",
      itemIds: ["Spinach", "Ground beef", "Eggs"],
    });
  });

  test("pending swipes alone make a digest", () => {
    expect(buildDigest([], 1, 0, NOW, PDT)).toEqual({ title: "1 item needs a swipe", body: "1 item needs a swipe.", itemIds: [] });
  });

  test("undated items are mentioned at most once a week", () => {
    const first = buildDigest([], 0, 2, NOW, PDT);
    expect(first).toEqual({ title: "2 items need a date", body: "2 items have no date yet.", itemIds: [], undatedCount: 2 });
    expect(buildDigest([], 0, 2, NOW, PDT, "2026-10-20")).toBeNull();
    expect(buildDigest([], 0, 2, NOW, PDT, "2026-10-17")?.undatedCount).toBe(2);
    expect(buildDigest([item("Eggs", 3)], 0, 2, NOW, PDT, "2026-10-20")).toEqual({
      title: "1 thing to use soon",
      body: "In 3 days: Eggs.",
      itemIds: ["Eggs"],
    });
  });

  test("nothing to report returns null", () => {
    expect(buildDigest([item("Cheese", 30), item("Apples", 2)], 0, 0, NOW, PDT)).toBeNull();
  });
});
