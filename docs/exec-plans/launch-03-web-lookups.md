# Launch-03: Web lookups inside Apify's free $5

Tier: Launch. Estimate: 4 to 6 hours for one engineer. Overview: [launch-00-free-tier-overview.md](launch-00-free-tier-overview.md).

## Purpose

Apify's free plan gives $5 of usage a month and 5 concurrent runs. One search with `rag-web-browser` costs about $0.007 (`docs/ARCHITECTURE.md`), so the free credit covers about 700 searches. Recipes search once per user per day of use, and a fresh deployment's StillTasty backfill costs about $4.50. At 100 users the recipe searches alone would cost about $11 a month. This plan makes each search reusable across users and sets a daily budget so the account never needs a paid plan.

## Context

State on 2026-10-26:

- `recipes.requestSuggestion` runs a search when a user's use-soon set changes, up to 3 times a day per user. Confirming a receipt and adding an item by hand both preload it, so a user can spend searches without opening the recipes tab.
- Each `recipeSuggestions` row belongs to one user and one day. Two users with the same three use-soon foods each pay for a search.
- `shelfLifeWeb.lookupNext` searches StillTasty for every food that `needsWebLookup`. The results land in the shared `foods` table, so each food is searched once per deployment. The dev deployment already holds the 2026-10-24 backfill of 674 foods; prod would pay for it again.
- A sixth concurrent run fails with 402 `concurrent-runs-limit-exceeded`. With real users, a lookup chain and a few recipe searches can hit that at the same time.
- Without `APIFY_TOKEN`, recipes fall back to the static list in `lib/recipes.ts` and the shelf-life lookup skips, so the app still works when the budget is spent.

## Steps

1. StillTasty snapshot. Export the web ranges, tips, and hints (with their `ref` URLs and quotes) from the dev deployment into `convex/data/stilltasty.json`, with a `stilltasty.script.mjs` next to it like the other data files. Import it in `foods:importReference` after the FDA and FoodKeeper rows, filling only empty fields so those sources still win. Set `webLookupAt` on imported foods so the chain skips them.
   Verify: on a fresh deployment, `importReference` followed by `shelfLifeWeb:lookupNext` searches only foods missing from the snapshot.
2. Shared recipe cache. Add a `recipeSearches` table keyed by the sorted ingredient names, holding the grounded recipes and the fetch time. `recipesWeb.suggest` reads it first and searches only on a miss or when the row is older than 30 days. `recipeSuggestions` rows point at the shared result. The recipes are public pages, so sharing them between users reveals nothing about a user beyond their three ingredient names, which are not stored with a user.
   Verify: two dev users with the same use-soon foods produce one Apify run.
3. Partial matches. When no cached set matches all three ingredients, use a cached set that shares two of them before searching, and rank recipes with `lib/recipeWeb.ts` as today. Put the matching in `lib/` with a test.
4. Daily budget. Count Apify runs per UTC day in a small `apifyUsage` table and stop at 20 a day (about $4.20 a month). Shelf-life lookups take priority over recipes, since dates are the core feature. When the budget is spent, recipes return the cached or static ones and the lookup chain stops until the next day.
   Verify: the 21st search of the day on dev returns cached or static recipes without calling Apify.
5. Preload only on a miss. Keep the preload after receipt confirmation, since the search takes about 98 seconds, but only when the shared cache has no match. Drop the preload from manual adds.
6. One chain at a time. Cap web lookups at one running chain, so lookups and recipe searches stay under the 5 concurrent runs.

## Fallback provider

If Apify's free plan changes, Tavily's free plan has 1,000 search credits a month (1 credit per basic search) and can return page content. `searchPages` in `convex/model/apify.ts` is the only function that talks to Apify, so a second provider means one new function with the same return type. Not needed now.

## Validation

- A week on dev with two or three testers stays under 20 Apify runs a day, shown on the Apify usage page.
- Recipes still appear when `APIFY_TOKEN` is unset.
- A fresh prod deployment has StillTasty tips without running the paid backfill.

## Open questions

1. StillTasty's terms of use: the snapshot stores short quotes with links, the same as the live lookup. Check the terms before shipping a committed copy.
2. Is 20 searches a day the right budget, or should recipes get a fixed share?

## Decision log

- 2026-10-26: Proposed a shared recipe cache and a daily Apify budget instead of a paid Apify plan.
