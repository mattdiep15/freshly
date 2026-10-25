import { describe, expect, it } from "vitest";
import {
  addDays,
  dateInputValue,
  daysAgoLabel,
  daysLeftLabel,
  daysUntil,
  endOfLocalDay,
  expiredLabel,
  freshness,
  groupByLocation,
  localNoon,
  numberWord,
  sortByUrgency,
  statusTiming,
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

describe("groupByLocation", () => {
  it("orders fridge, freezer, pantry and skips empty locations", () => {
    const items = [
      { name: "beans", location: "pantry" as const },
      { name: "peas", location: "freezer" as const },
      { name: "milk", location: "fridge" as const },
    ];
    expect(groupByLocation(items).map((g) => g.location)).toEqual(["fridge", "freezer", "pantry"]);
    expect(groupByLocation(items.slice(0, 1)).map((g) => g.location)).toEqual(["pantry"]);
    expect(groupByLocation([])).toEqual([]);
  });

  it("keeps the incoming order within a location", () => {
    const items = [
      { name: "a", location: "fridge" as const },
      { name: "b", location: "freezer" as const },
      { name: "c", location: "fridge" as const },
    ];
    expect(groupByLocation(items)[0].items.map((i) => i.name)).toEqual(["a", "c"]);
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

describe("addDays", () => {
  it("crosses month ends", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
  });
});

describe("localNoon", () => {
  it("lands on the given local day", () => {
    expect(dateInputValue(localNoon("2026-10-20"))).toBe("2026-10-20");
  });
});

describe("statusTiming", () => {
  it("counts down before the date and up after it", () => {
    expect(statusTiming(at(26), now)).toBe("3 days");
    expect(statusTiming(at(23), now)).toBe("today");
    expect(statusTiming(at(21), now)).toBe("2 days ago");
    expect(statusTiming(undefined, now)).toBeNull();
  });
});
