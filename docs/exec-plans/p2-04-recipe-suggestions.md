# P2-04: Recipe suggestions from the web (Apify + Gemini)

Tier: P2. Estimate: 3 to 4 hours for one engineer. Depends on p2-01 and the v5 frontend branch. Can run in parallel with p2-02 and p2-03.

Moved up from `p3-integrations.md` on 2026-10-24: the designer is drawing the recipes tab now and v5 already ships it with a fixed list. This is option 3 from the old p3 section, the one that uses both sponsor technologies.

## Purpose

Replace the five fixed recipes in v5's `lib/recipes.ts` with real recipes found on the web for the items about to expire. Apify fetches recipe pages and Gemini turns them into the recipe cards the tab already renders. This covers "Recipe recommendations ... ranked by which items expire soonest" in `docs/PRODUCT.md` and counts for the Apify and Gemini tracks (see p1-05).

## Context

- Code paths are relative to `web/`.
- v5's recipes page (`app/recipes/page.tsx`) builds ingredient chips from use-soon items and ranks recipes with `rankRecipes(RECIPES, soonItems, selected)` from `lib/recipes.ts`. `rankRecipes` matches each recipe's `ingredients` (generic words like "chicken") against item names. Recipes from the web must use the same generic words or they will not match.
- Each recipe card needs more than a title and link: `minutes`, `dish`, `cookTool`, `heat`, `servings`, and `steps` with a `phase` and optional `timedMinutes` for the cooking timer. Gemini fills these from the page. `dish`, `cookTool`, and `heat` only pick drawings, so a rough guess is fine.
- `convex/shelfLifeWeb.ts` already calls Apify's `apify/rag-web-browser` with `APIFY_TOKEN`, and reads pages with Gemini, falling back to Claude when Gemini fails. This plan reuses both.
- The `recipeSuggestions` table and `recipe` validator are in p2-01.
- Recipe steps are not safety claims under `CLAUDE.md`, but recipe text is the page author's. Gemini writes each step in its own short words, and the card links to the source for the full recipe.

## Behavior

1. The recipes page calls the mutation `recipes.request()` when it opens. It takes the caller's active items with `expiresAt` in the next 3 days (v5's `USE_SOON_DAYS`), soonest first, and uses the `foods.name` of the first three as ingredients (`"chicken breast"`, not the receipt's `"KS CHKN BRST"`).
2. If today's row (by `by_user_date` and the user's local `dateKey`) has the same ingredients and is `pending` or `ready`, `request` returns it. Otherwise it writes a `pending` row, replacing today's row, and schedules `recipesWeb.suggest({ suggestionId })`. Cap new rows at 3 per user per day so a fridge that keeps changing does not keep starting Apify runs. With no use-soon items, it does nothing.
3. `recipesWeb.suggest` searches Apify for `recipe <ingredient> <ingredient>` with `maxResults: 5` and no site allowlist. Gemini reads the pages and returns up to 3 recipes in the `recipe` shape, plus the `sourceUrl` each came from.
4. `groundedRecipes(recipes, pageUrls)` in `lib/recipeWeb.ts` is pure. It drops any recipe whose `sourceUrl` is not one of the fetched pages, drops recipes with no steps, lowercases ingredients, and clamps `minutes` and `servings` to sensible bounds. The internal mutation `recipes.save` stores the result as `ready`, or `failed` with the error.
5. The query `recipes.today()` returns today's row or `null`. The page ranks today's web recipes and the fixed `RECIPES` together with `rankRecipes`, web recipes first on a tie. While the row is `pending` or `failed`, the fixed list still shows, so the tab never sits empty.

Without `APIFY_TOKEN`, `suggest` saves `failed` with "APIFY_TOKEN is not set" and the page shows the fixed list.

## Steps

1. Move `searchPages` from `convex/shelfLifeWeb.ts` to `convex/model/apify.ts` with an optional site filter, so both callers share it. Shelf-life lookups keep their `allowedSite` filter.
   Verify: `npx convex run shelfLifeWeb:lookupNext` still saves a range for a food with no FDA or FoodKeeper entry.

2. Add `RECIPE_SCHEMA` and `recipeSystemPrompt(ingredients)` to `convex/model/llm.ts`. The prompt says: use only recipes on the given pages, copy each recipe's real URL, list ingredients as one or two generic lowercase words, write steps in your own short words with prep, cook, and serve phases, and set `timedMinutes` only when the page gives a time.

3. Write `lib/recipeWeb.ts` and `lib/recipeWeb.test.ts` for `groundedRecipes`. Cover: a recipe citing an unfetched URL is dropped; ingredient case is normalized; `minutes` of 0 or 900 is clamped; a recipe with no steps is dropped.
   Verify: `npm test` passes.

4. Write `convex/recipes.ts` (`request`, `today`, internal `save`) and `convex/recipesWeb.ts` (internal action `suggest`, Gemini first and Claude on failure, like `shelfLifeWeb.extract`).
   Verify: after `/api/dev/seed`, `/api/recipes/request` then `/api/recipes/today` returns a `ready` row within a minute, and every `sourceUrl` opens a real recipe page that uses at least one of the ingredients.

5. Add `/api` routes following p1-01:
   - `GET /api/recipes/request` (dev-only GET, since it writes)
   - `GET /api/recipes/today`

6. Recipes page: call `recipes.request` on mount, merge `recipes.today` with `RECIPES`, and show "from <site>" with the source link on web recipe cards. Keep the `TODO(release)` on the fixed list. It now serves as the fallback.
   Verify: in the running app, the recipes tab shows web recipes for the seeded use-soon items, and selecting a chip filters them like the fixed ones.

## File ownership

This plan owns `convex/recipes.ts`, `convex/recipesWeb.ts`, `convex/model/apify.ts`, the recipe parts of `convex/model/llm.ts`, `lib/recipeWeb.ts` and its test, `app/api/recipes/`, `app/recipes/page.tsx`, and `app/_components/RecipeList.tsx`. It moves `searchPages` out of `convex/shelfLifeWeb.ts`; no other P2 plan edits that file.

## Interfaces delivered

| Convex function | Kind | Test route |
| --- | --- | --- |
| `recipes.request()` | mutation | `GET /api/recipes/request` |
| `recipes.today()` | query | `GET /api/recipes/today` |
| `recipesWeb.suggest({ suggestionId })` | internal action | via `request` |

`recipes.today` returns `{ _id, dateKey, ingredients, status, recipes, error? } | null`. Each recipe has the v5 `Recipe` fields plus `sourceUrl`.

## Progress

- [x] 0. p2-01's `recipeStep` and `recipe` validators, the `recipeSuggestions` table, and `Recipe.sourceUrl`, added here because p2-01 was not run on its own (2026-10-24)
- [x] 1. `convex/model/apify.ts` (2026-10-24). Not yet verified with `shelfLifeWeb:lookupNext`: the worktree's local deployment has no `APIFY_TOKEN`.
- [x] 2. Recipe schema and prompt (2026-10-24)
- [x] 3. `lib/recipeWeb.ts` and tests (2026-10-24)
- [x] 4. `convex/recipes.ts` and `convex/recipesWeb.ts` (2026-10-24). Checked on a local deployment without `APIFY_TOKEN`: `request` writes a `pending` row, `suggest` saves `failed` with "APIFY_TOKEN is not set", the fourth call of the day returns the newest row without a new run, and a `ready` row with the same ingredients is returned as is. The Apify and Gemini run is not yet checked.
- [x] 5. `/api` routes (2026-10-24)
- [x] 6. Recipes page (2026-10-24). Clicked through on a local deployment with a hand-saved `ready` row: the web recipe ranks first, shows "from example.com", and the mushroom chip filters to it.

## Validation

- `npm run lint`, `npm run typecheck`, and `npm test` pass.
- Every stored web recipe has a `sourceUrl` from that run's Apify results.
- Opening the recipes tab twice on the same day with the same fridge starts one Apify run.
- With `APIFY_TOKEN` unset, the tab still shows the fixed recipes.

## Open questions

1. "MISE" in the spec. Confirm whether it names a product or dataset the team wants to use instead of web search.
2. Speed. An Apify run plus a Gemini call can take 20 to 60 seconds. If that feels slow in the demo, run `request` for the demo user before presenting so today's row is already `ready`.

## Decision log

- 2026-10-24: Recipes moved from p3 to p2 because the recipes tab is in v5 and the designer is working on it.
- 2026-10-24: Cache one row per user per day, refreshed only when the use-soon ingredients change, at most 3 runs a day.
- 2026-10-24: Keep the fixed recipes as a fallback instead of deleting them, so the tab works without Apify.
- 2026-10-24: Each run inserts a new row instead of replacing today's row, so the 3-a-day cap can count today's rows. `today` and `request` use the newest one.
- 2026-10-24: A `failed` row, or a run that finds no grounded recipes (saved as `failed`), is retried on the next page open and counts against the cap.
- 2026-10-24: `groundedRecipes` assigns ids (`web-<n>-<slug>`), keeps at most 3 recipes, dedupes ingredients, and clamps `minutes` to 5-240, `servings` to 1-12, and `timedMinutes` to the recipe's `minutes`.
- 2026-10-24: Web recipes can have several steps in one phase, so `RecipeList` keys steps by index instead of phase.
- 2026-10-24: The "from <site>" link sits in the recipe's meta row with no new CSS, since the v6 port owns the styles.
- 2026-10-24: `recipes.today` reads `Date.now()` for the local date, like `items.list`. Convex's guidelines advise passing time in instead; the page also calls `request` on mount, which writes and so refreshes the query.

## Surprises

- `react-hooks/rules-of-hooks` lints Convex files too: a helper named `useSoonIngredients` failed lint, so it is `soonestIngredients`.
- `npm run typecheck` failed in the worktree on stale `.next/dev/types` from an older route set ("Cannot find module '../../../app/page.js'"). Deleting `.next/dev/types` fixed it; nothing in the repo changed.
