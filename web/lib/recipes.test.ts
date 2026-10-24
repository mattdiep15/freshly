import { describe, expect, it } from "vitest";
import { rankRecipes, RECIPES, usesItem, type Recipe } from "./recipes";

describe("usesItem", () => {
  it("matches generic ingredient words inside a fridge item's name", () => {
    expect(usesItem("chicken", "Chicken breast")).toBe(true);
    expect(usesItem("greek yogurt", "Greek yogurt")).toBe(true);
    expect(usesItem("strawberries", "strawberry")).toBe(true);
    expect(usesItem("eggs", "Eggs")).toBe(true);
  });

  it("needs every ingredient word", () => {
    expect(usesItem("greek yogurt", "plain yogurt")).toBe(false);
    expect(usesItem("olive oil", "Olive bread")).toBe(false);
  });
});

const recipe = (id: string, ingredients: string[]): Recipe => ({
  ...RECIPES[0],
  id,
  ingredients,
});

describe("rankRecipes", () => {
  const spinach = { name: "Baby spinach", daysLeft: 2 };
  const chicken = { name: "Chicken breast", daysLeft: 1 };
  const eggs = { name: "Eggs", daysLeft: 3 };
  const catalog = [
    recipe("eggs-only", ["eggs"]),
    recipe("chicken-spinach", ["chicken", "spinach"]),
    recipe("spinach-only", ["spinach"]),
    recipe("rice", ["rice"]),
  ];
  const ids = (ranked: { recipe: Recipe }[]) => ranked.map((r) => r.recipe.id);

  it("ranks by use-soon items used, then by the nearest expiry, then catalog order", () => {
    expect(ids(rankRecipes(catalog, [spinach, chicken, eggs], []))).toEqual([
      "chicken-spinach",
      "spinach-only",
      "eggs-only",
      "rice",
    ]);
  });

  it("keeps only recipes that use every selected item", () => {
    expect(ids(rankRecipes(catalog, [spinach, chicken, eggs], [spinach]))).toEqual(["chicken-spinach", "spinach-only"]);
    expect(ids(rankRecipes(catalog, [spinach, chicken, eggs], [spinach, eggs]))).toEqual([]);
  });

  it("lists which use-soon items each recipe uses", () => {
    const [top] = rankRecipes(catalog, [spinach, chicken], []);
    expect(top.uses).toEqual([spinach, chicken]);
  });

  it("keeps catalog order when nothing is expiring", () => {
    expect(ids(rankRecipes(catalog, [], []))).toEqual(["eggs-only", "chicken-spinach", "spinach-only", "rice"]);
  });
});
