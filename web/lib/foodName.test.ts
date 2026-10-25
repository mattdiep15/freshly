import { describe, expect, it } from "vitest";
import { splitFoodName } from "./foodName";

describe("splitFoodName", () => {
  it("splits the food from its variants at the first comma", () => {
    expect(splitFoodName("cream pies, banana cream, coconut cream, butterscotch")).toEqual({
      base: "cream pies",
      detail: "banana cream, coconut cream, butterscotch",
    });
  });

  it("keeps a qualifier with the variants", () => {
    expect(splitFoodName("muffin, homemade - including bran, blueberry")).toEqual({
      base: "muffin",
      detail: "homemade - including bran, blueberry",
    });
  });

  it("leaves names without a comma whole", () => {
    expect(splitFoodName("bananas")).toEqual({ base: "bananas", detail: "" });
  });
});
