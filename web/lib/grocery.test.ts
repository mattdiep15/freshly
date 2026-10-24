import { describe, expect, it } from "vitest";
import { groceryHint, groceryKey } from "./grocery";

describe("groceryKey", () => {
  it("ignores case and extra spaces", () => {
    expect(groceryKey("  Oat   Milk ")).toBe("oat milk");
  });
});

describe("groceryHint", () => {
  const none = { wastedNames: [], fridge: [], soonNames: [] };

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
