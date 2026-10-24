import { describe, expect, it } from "vitest";
import { groundedRecipes, siteName, type WebRecipe } from "./recipeWeb";

const PAGE = "https://example.com/chicken-spinach-pasta";

const webRecipe = (overrides: Partial<WebRecipe> = {}): WebRecipe => ({
  name: "Chicken Spinach Pasta",
  ingredients: ["chicken", "spinach", "pasta"],
  minutes: 25,
  dish: "pot",
  cookTool: "pot",
  heat: "medium",
  servings: 2,
  steps: [
    { phase: "prep", text: "Slice the chicken.", timedMinutes: null },
    { phase: "cook", text: "Cook everything together.", timedMinutes: 15 },
  ],
  sourceUrl: PAGE,
  ...overrides,
});

describe("groundedRecipes", () => {
  it("keeps a recipe from a fetched page in the card's shape", () => {
    const [recipe] = groundedRecipes([webRecipe()], [PAGE]);
    expect(recipe).toEqual({
      id: "web-0-chicken-spinach-pasta",
      name: "chicken spinach pasta",
      ingredients: ["chicken", "spinach", "pasta"],
      minutes: 25,
      dish: "pot",
      cookTool: "pot",
      heat: "medium",
      servings: 2,
      steps: [
        { phase: "prep", text: "Slice the chicken." },
        { phase: "cook", text: "Cook everything together.", timedMinutes: 15 },
      ],
      sourceUrl: PAGE,
    });
  });

  it("drops a recipe that cites a page this run did not fetch", () => {
    const madeUp = webRecipe({ sourceUrl: "https://example.com/not-fetched" });
    expect(groundedRecipes([madeUp], [PAGE])).toEqual([]);
  });

  it("lowercases and dedupes ingredients", () => {
    const [recipe] = groundedRecipes([webRecipe({ ingredients: ["Chicken", " Greek Yogurt ", "chicken", ""] })], [PAGE]);
    expect(recipe.ingredients).toEqual(["chicken", "greek yogurt"]);
  });

  it("clamps minutes and servings to sensible bounds", () => {
    const [quick, slow] = groundedRecipes(
      [webRecipe({ minutes: 0, servings: 0 }), webRecipe({ minutes: 900, servings: 40 })],
      [PAGE],
    );
    expect([quick.minutes, quick.servings]).toEqual([5, 1]);
    expect([slow.minutes, slow.servings]).toEqual([240, 12]);
  });

  it("drops a recipe with no steps", () => {
    const blank = webRecipe({ steps: [{ phase: "cook", text: "  ", timedMinutes: null }] });
    expect(groundedRecipes([webRecipe({ steps: [] }), blank], [PAGE])).toEqual([]);
  });

  it("keeps at most three recipes", () => {
    expect(groundedRecipes(Array.from({ length: 5 }, () => webRecipe()), [PAGE])).toHaveLength(3);
  });
});

describe("siteName", () => {
  it("drops www from the host", () => {
    expect(siteName("https://www.bbcgoodfood.com/recipes/x")).toBe("bbcgoodfood.com");
  });
});
