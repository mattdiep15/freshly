import { describe, expect, it } from "vitest";
import { fullnessStage, groupForCategory, stashGroupFor, stashGroups } from "./fullness";

describe("fullnessStage", () => {
  it("steps up at 4, 7, and 11 items", () => {
    expect([0, 3, 4, 6, 7, 10, 11, 40].map(fullnessStage)).toEqual([10, 10, 40, 40, 70, 70, 100, 100]);
  });
});

describe("groupForCategory", () => {
  it("maps reference categories to manual-entry groups", () => {
    expect(groupForCategory("poultry")).toBe("protein");
    expect(groupForCategory("eggs")).toBe("dairy-eggs");
    expect(groupForCategory("bakery")).toBe("grains");
    expect(groupForCategory("condiments")).toBe("other");
  });

  it("leaves produce for the user to pick", () => {
    expect(groupForCategory("produce")).toBeNull();
  });
});

describe("stashGroupFor", () => {
  it("splits produce into fruit and vegetables", () => {
    expect(stashGroupFor("citrus fruit, lemon, lime, orange, grapefruit, tangerines, clementines", "produce")).toBe("fruit");
    expect(stashGroupFor("strawberries", "produce")).toBe("fruit");
    expect(stashGroupFor("dates", "produce")).toBe("fruit");
    expect(stashGroupFor("carrots, parsnips", "produce")).toBe("vegetables");
    expect(stashGroupFor("tomatoes", "produce")).toBe("vegetables");
  });

  it("maps the other summary groups and leaves out the rest", () => {
    expect(stashGroupFor("chicken breast", "poultry")).toBe("protein");
    expect(stashGroupFor("eggs", "eggs")).toBe("dairy");
    expect(stashGroupFor("frozen dinners", "frozen")).toBe("frozen foods");
    expect(stashGroupFor("ketchup", "condiments")).toBeNull();
  });
});

describe("stashGroups", () => {
  it("lists every group as empty for an empty fridge", () => {
    expect(stashGroups([])).toEqual({
      stocked: [],
      empty: ["vegetables", "fruit", "protein", "dairy", "grains", "frozen foods"],
    });
  });

  it("counts freezer items as frozen food", () => {
    const { stocked, empty } = stashGroups([
      { stashGroup: "fruit", location: "fridge" },
      { stashGroup: "protein", location: "freezer" },
      { stashGroup: null, location: "pantry" },
    ]);
    expect(stocked).toEqual(["fruit", "protein", "frozen foods"]);
    expect(empty).toEqual(["vegetables", "dairy", "grains"]);
  });
});
