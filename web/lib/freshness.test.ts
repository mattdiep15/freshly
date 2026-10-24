import { describe, expect, it } from "vitest";
import {
  dateInputValue,
  daysAgoLabel,
  daysLeftLabel,
  daysUntil,
  endOfLocalDay,
  expiredLabel,
  freshness,
  numberWord,
  sortByUrgency,
  pickUseSoon,
} from "./freshness";

// Local-time dates keep the tests independent of the machine's timezone.
const now = new Date(2026, 9, 23, 10, 0).getTime();
const at = (day: number, hour = 20) => new Date(2026, 9, day, hour, 0).getTime();

describe("daysUntil", () => {
  it("counts calendar days, not 24h blocks", () => {
    expect(daysUntil(at(23), now)).toBe(0);
    expect(daysUntil(at(24, 1), now)).toBe(1);
    expect(daysUntil(at(30), now)).toBe(7);
  });
});

describe("freshness", () => {
  it("is unknown without a date", () => {
    expect(freshness(undefined, now)).toBe("unknown");
  });

  it("is expired once the time has passed", () => {
    expect(freshness(at(23, 9), now)).toBe("expired");
  });

  it("is soon within three days", () => {
    expect(freshness(at(23), now)).toBe("soon");
    expect(freshness(at(26), now)).toBe("soon");
  });

  it("is fresh after three days", () => {
    expect(freshness(at(27), now)).toBe("fresh");
  });
});

describe("daysLeftLabel", () => {
  it("labels each case", () => {
    expect(daysLeftLabel(undefined, now)).toBe("no date");
    expect(daysLeftLabel(at(22), now)).toBe("expired");
    expect(daysLeftLabel(at(23), now)).toBe("today");
    expect(daysLeftLabel(at(24), now)).toBe("1 day");
    expect(daysLeftLabel(at(29), now)).toBe("6 days");
  });
});

describe("daysAgoLabel", () => {
  it("counts calendar days since the date", () => {
    expect(daysAgoLabel(at(23, 8), now)).toBe("today");
    expect(daysAgoLabel(at(22), now)).toBe("1 day ago");
    expect(daysAgoLabel(at(20), now)).toBe("3 days ago");
  });
});

describe("expiredLabel", () => {
  it("counts calendar days since expiry", () => {
    expect(expiredLabel(at(23, 8), now)).toBe("expired today");
    expect(expiredLabel(at(22), now)).toBe("expired 1 day ago");
    expect(expiredLabel(at(19), now)).toBe("expired 4 days ago");
  });
});

describe("sortByUrgency", () => {
  it("orders expired, soon, fresh, then undated", () => {
    const items = [
      { name: "expired", expiresAt: at(20) },
      { name: "undated" },
      { name: "fresh", expiresAt: at(30) },
      { name: "soon-later", expiresAt: at(25) },
      { name: "soon-first", expiresAt: at(23) },
    ];
    expect(sortByUrgency(items, now).map((i) => i.name)).toEqual([
      "expired",
      "soon-first",
      "soon-later",
      "fresh",
      "undated",
    ]);
  });
});

describe("pickUseSoon", () => {
  it("returns only soon items, most urgent first, capped at the limit", () => {
    const items = [
      { name: "a", expiresAt: at(26) },
      { name: "b", expiresAt: at(23) },
      { name: "c", expiresAt: at(30) },
      { name: "d", expiresAt: at(24) },
      { name: "e", expiresAt: at(25) },
    ];
    expect(pickUseSoon(items, now).map((i) => i.name)).toEqual(["b", "d", "e"]);
  });
});

describe("numberWord", () => {
  it("spells small numbers and falls back to digits", () => {
    expect(numberWord(3)).toBe("three");
    expect(numberWord(12)).toBe("12");
  });
});

describe("endOfLocalDay and dateInputValue", () => {
  it("turns a picked date into the end of that local day", () => {
    expect(endOfLocalDay("2026-10-30")).toBe(new Date(2026, 9, 30, 23, 59).getTime());
  });

  it("round-trips through the date input value", () => {
    expect(dateInputValue(endOfLocalDay("2026-01-05"))).toBe("2026-01-05");
    expect(dateInputValue(at(23, 0))).toBe("2026-10-23");
  });
});
