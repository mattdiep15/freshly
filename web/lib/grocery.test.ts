import { describe, expect, it } from "vitest";
import { entriesToCheckOff, groceryHint, groceryKey } from "./grocery";

describe("groceryKey", () => {
  it("ignores case and extra spaces", () => {
    expect(groceryKey("  Oat   Milk ")).toBe("oat milk");
  });
});

describe("groceryHint", () => {
  const none = { wastedNames: [], fridge: [], soonNames: [] };

  it("names the recipe an entry was added for before anything else", () => {
    const hint = groceryHint("strawberries", { ...none, wastedNames: ["strawberries"] }, "Berry Smoothie");
    expect(hint).toEqual({ kind: "recipe", text: "for berry smoothie." });
  });

  it("warns about past waste first", () => {
    const hint = groceryHint("strawberries", {
      ...none,
      wastedNames: ["Strawberries"],
      fridge: [{ name: "Strawberries", quantity: 1 }],
    });
    expect(hint?.kind).toBe("wasted");
  });

  it("sums matching fridge quantities", () => {
    const hint = groceryHint("eggs", {
      ...none,
      fridge: [
        { name: "Large cage-free white eggs", quantity: 12 },
        { name: "Eggs", quantity: 6 },
        { name: "Unsalted butter", quantity: 1 },
      ],
    });
    expect(hint).toEqual({ kind: "in-fridge", text: "you still have 18 in your fridge.", count: 18 });
  });

  it("pairs with a use-soon food only when nothing ranks higher", () => {
    expect(groceryHint("rice", { ...none, soonNames: ["Salmon fillet"] })?.text).toBe("goes well with salmon.");
    expect(groceryHint("rice", { ...none, soonNames: ["Chicken breast"] })).toBeNull();
  });

  it("has no hint for an unknown food", () => {
    expect(groceryHint("dragonfruit", none)).toBeNull();
  });
});

describe("entriesToCheckOff", () => {
  const spinach = { _id: "e1", name: "spinach", foodId: "f-spinach" };

  it("matches on foodId when both have one", () => {
    expect(entriesToCheckOff([spinach], [{ name: "Baby spinach", foodId: "f-spinach" }])).toEqual(["e1"]);
  });

  it("matches on name when the entry has no foodId", () => {
    expect(entriesToCheckOff([{ _id: "e2", name: "Oat milk " }], [{ name: "oat milk", foodId: "f-oat" }])).toEqual(["e2"]);
  });

  it("does not match different foods with similar names", () => {
    expect(entriesToCheckOff([spinach], [{ name: "spinach", foodId: "f-frozen-spinach" }])).toEqual([]);
  });

  it("skips entries already checked", () => {
    expect(entriesToCheckOff([{ ...spinach, checkedAt: 1 }], [{ name: "spinach", foodId: "f-spinach" }])).toEqual([]);
  });

  it("checks off every entry for the same food", () => {
    const twice = [spinach, { ...spinach, _id: "e3" }];
    expect(entriesToCheckOff(twice, [{ name: "spinach", foodId: "f-spinach" }])).toEqual(["e1", "e3"]);
  });
});
