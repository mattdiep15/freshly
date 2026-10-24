import { describe, expect, it } from "vitest";
import { fullnessStage, groupForCategory } from "./fullness";

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
