import { describe, expect, test } from "vitest";
import { mergeReferenceFood, type ReferenceFood } from "./referenceMerge";

const fda: ReferenceFood = {
  name: "eggs",
  aliases: ["egg"],
  category: "eggs",
  defaultLocation: "fridge",
  fridgeDays: { min: 21, max: 35, source: "fda_chart", ref: "FDA chart 2018-03 > Eggs > Fresh, in shell" },
};
const foodkeeper: ReferenceFood = {
  name: "eggs",
  aliases: ["eggs, in shell", "Egg"],
  category: "dairy",
  defaultLocation: "pantry",
  fridgeDays: { min: 20, max: 30, source: "foodkeeper", ref: "FoodKeeper v128 > #21" },
  pantryDays: { min: 1, max: 2, source: "foodkeeper", ref: "FoodKeeper v128 > #21 pantry" },
  storageTip: { text: "Freezer: not recommended.", source: "foodkeeper" },
};

describe("mergeReferenceFood", () => {
  test("inserts a new food as-is with clean aliases", () => {
    expect(mergeReferenceFood(null, { ...fda, aliases: ["Egg", "eggs", "egg"] }).aliases).toEqual(["egg"]);
  });

  test("keeps the FDA range for a location and adds FoodKeeper's other locations", () => {
    const merged = mergeReferenceFood(fda, foodkeeper);
    expect(merged.fridgeDays).toEqual(fda.fridgeDays);
    expect(merged.pantryDays).toEqual(foodkeeper.pantryDays);
    expect(merged.category).toBe("eggs");
    expect(merged.defaultLocation).toBe("fridge");
    expect(merged.aliases).toEqual(["egg", "eggs, in shell"]);
    expect(merged.storageTip).toEqual(foodkeeper.storageTip);
  });

  test("FDA arriving after FoodKeeper still wins", () => {
    const merged = mergeReferenceFood(mergeReferenceFood(null, foodkeeper), fda);
    expect(merged.fridgeDays).toEqual(fda.fridgeDays);
    expect(merged.pantryDays).toEqual(foodkeeper.pantryDays);
    expect(merged.category).toBe("eggs");
  });

  test("is idempotent", () => {
    const once = mergeReferenceFood(mergeReferenceFood(null, fda), foodkeeper);
    const twice = mergeReferenceFood(mergeReferenceFood(once, fda), foodkeeper);
    expect(twice).toEqual(once);
  });

  test("a model-written tip never replaces a sourced one", () => {
    const merged = mergeReferenceFood(foodkeeper, { ...foodkeeper, storageTip: { text: "guess", source: "llm" } });
    expect(merged.storageTip).toEqual(foodkeeper.storageTip);
  });
});
