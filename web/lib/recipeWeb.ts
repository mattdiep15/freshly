import type { Recipe, RecipeStep } from "./recipes";

const MAX_RECIPES = 3;

// A recipe as the model returns it from a web page; mirrors RECIPE_SCHEMA in convex/model/llm.ts.
export type WebRecipe = Omit<Recipe, "id" | "steps" | "sourceUrl"> & {
  steps: { phase: RecipeStep["phase"]; text: string; timedMinutes: number | null }[];
  sourceUrl: string;
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Keeps recipes that cite a page this run fetched and have steps, and normalizes them to the card's shape.
export function groundedRecipes(recipes: WebRecipe[], pageUrls: string[]): Recipe[] {
  const fetched = new Set(pageUrls);
  return recipes
    .filter((r) => fetched.has(r.sourceUrl))
    .map((r) => ({ ...r, steps: r.steps.filter((s) => s.text.trim()) }))
    .filter((r) => r.steps.length > 0)
    .slice(0, MAX_RECIPES)
    .map((r, index) => {
      const minutes = clamp(r.minutes, 5, 240);
      return {
        id: `web-${index}-${slug(r.name)}`,
        name: r.name.trim().toLowerCase(),
        ingredients: [...new Set(r.ingredients.map((i) => i.trim().toLowerCase()).filter(Boolean))],
        minutes,
        dish: r.dish,
        cookTool: r.cookTool,
        heat: r.heat.trim().toLowerCase(),
        servings: clamp(r.servings, 1, 12),
        steps: r.steps.map(({ phase, text, timedMinutes }) => ({
          phase,
          text: text.trim(),
          ...(timedMinutes && timedMinutes > 0 ? { timedMinutes: clamp(timedMinutes, 1, minutes) } : {}),
        })),
        sourceUrl: r.sourceUrl,
      };
    });
}

// "www.bbcgoodfood.com" -> "bbcgoodfood.com", for the "from <site>" label.
export function siteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
