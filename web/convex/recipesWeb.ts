import { v } from "convex/values";
import { groundedRecipes, type WebRecipe } from "../lib/recipeWeb";
import type { Recipe } from "../lib/recipes";
import type { WebPage } from "../lib/webShelfLife";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { searchPages } from "./model/apify";
import { askClaude } from "./model/claude";
import { askGemini } from "./model/gemini";
import { RECIPE_SCHEMA, recipeSystemPrompt } from "./model/llm";

// Gemini reads the pages for the Gemini track; Claude covers a Gemini outage or a spent free-tier quota.
async function extract(ingredients: string[], pages: WebPage[]): Promise<WebRecipe[]> {
  const system = recipeSystemPrompt(ingredients);
  const parts = pages.map((p) => ({ type: "text" as const, text: `URL: ${p.url}\n\n${p.markdown}` }));
  try {
    return ((await askGemini(system, parts, RECIPE_SCHEMA)) as { recipes: WebRecipe[] }).recipes;
  } catch (e) {
    console.warn(`recipesWeb: Gemini failed, using Claude: ${e instanceof Error ? e.message.slice(0, 120) : e}`);
    return ((await askClaude(system, parts, RECIPE_SCHEMA)) as { recipes: WebRecipe[] }).recipes;
  }
}

// Scheduled by recipes.request; finds recipes on the web for the row's ingredients.
export const suggest = internalAction({
  args: { suggestionId: v.id("recipeSuggestions") },
  handler: async (ctx, { suggestionId }): Promise<void> => {
    const row = await ctx.runQuery(internal.recipes.get, { suggestionId });
    if (!row) return;
    const save = async (recipes: Recipe[], error?: string) => {
      await ctx.runMutation(internal.recipes.save, { suggestionId, recipes, error });
    };
    const token = process.env.APIFY_TOKEN;
    if (!token) return await save([], "APIFY_TOKEN is not set");
    try {
      const pages = await searchPages(`recipe ${row.ingredients.join(" ")}`, token);
      if (pages.length === 0) return await save([], "No recipe pages found");
      const recipes = groundedRecipes(await extract(row.ingredients, pages), pages.map((p) => p.url));
      console.log(`recipesWeb: ${row.ingredients.join(", ")}: ${pages.length} pages, ${recipes.length} recipes`);
      if (recipes.length === 0) return await save([], "No recipes on the fetched pages");
      await save(recipes);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`recipesWeb: ${row.ingredients.join(", ")}: ${message}`);
      await save([], message.slice(0, 500));
    }
  },
});
