# P1-04: Sponsor tracks (Apify, Gemini, GoDaddy)

Tier: P1 (the hackathon judges these tracks). Estimate: 8 to 10 hours for one engineer, split into four parts that can ship one at a time. Depends on p1-02. Status: draft. Open questions 8 and 9 in the README must be answered before part B or C starts.

## Purpose

`docs/design_tracks.pdf` lists the tracks the team is entering: Apify, Gemini, Convex, GoDaddy, People-First Social Impact, Best Planet-First Hack, and Figma Best Design. This plan puts each sponsor technology where it does real work in Freshly:

- Apify fetches web pages: shelf-life guidance for foods the FDA chart and FoodKeeper do not cover, and real recipes for items about to expire.
- Gemini reads what Apify fetches and reads receipts: it extracts the shelf-life sentence from a page, parses receipt photos, and ranks recipes.
- GoDaddy holds the project's domain.

The tracks doc puts it as "apify gets data, gemini interprets it". This plan keeps that split.

## Track map

| Track | Where it fits | Plan |
| --- | --- | --- |
| Apify | Web shelf-life lookup (part B), recipe search (part C) | This plan |
| Gemini | Receipt parsing, manual-add matching, tip backfill (part A); shelf-life extraction (B); recipe ranking (C) | This plan |
| Convex | Already the backend: file storage for receipt photos, actions that call Gemini and Apify, the scheduler that runs lookups after a parse | p1-01, p1-02, this plan |
| GoDaddy | Domain for the Vercel deployment (part D) | This plan |
| People-First Social Impact | Food safety for students: sourced dates, storage tips, "looks spoiled?" card | p1-02, p1-03; pitch only |
| Best Planet-First Hack | Food waste measured in dollars and pounds | p1-03 waste stats; pitch only |
| Figma Best Design | Mascot and UI | Design work, no plan |

## Context

- Every model call goes through `askJson` in `convex/model/claude.ts`. It has three callers: `receiptsNode.parse`, `receiptsNode.addManual`, and `foods.backfillTips`. Switching providers means changing one helper and its content blocks, not three features.
- `foods` rows carry shelf-life ranges as `{ min, max, source, ref }`. `source` is `fda_chart` or `foodkeeper`. Of the 704 reference rows, 43 have no range at all (for example sour cream, pudding, soda, boxed juice). Every food Claude creates from a receipt line (for example `energy drink`, `instant noodles`) also has none. Those are the foods part B targets.
- `CLAUDE.md` allows shelf-life numbers only from the FDA chart or FoodKeeper. Part B adds a third source, so it needs the rule change in open question 8 first.
- Store product pages (Costco, Trader Joe's, Safeway) do not list shelf life or expiry dates, because the printed date differs per package. Apify scrapers for those stores return name, brand, price, and specs only. See the Decision log.

## Part A: Gemini as the model provider (about 3 hours)

1. Add `@google/genai` and set `GEMINI_API_KEY` with `npx convex env set`. Add `LLM_PROVIDER` (`gemini` or `anthropic`, default `gemini`) and `GEMINI_MODEL` (default `gemini-3.8-flash`; confirm the ID on the Gemini models page before coding).
2. Move the provider-neutral parts of `convex/model/claude.ts` (schemas, prompts) into `convex/model/llm.ts`. Keep `askJson` as the one entry point and have it dispatch on `LLM_PROVIDER`. The Gemini branch sends images and PDFs as inline data parts and the schema as `responseJsonSchema` with `responseMimeType: "application/json"`.
3. Keep the Anthropic branch working, so the team can switch back with one env var if Gemini scores worse.
   Verify: re-run the p1-02 live checks (Surprises, steps 1 to 6) with `LLM_PROVIDER=gemini`. Record the score next to Claude's 36 of 36 names and prices and 33 of 36 food matches.

## Part B: Web shelf-life lookup with Apify and Gemini (about 3 to 4 hours)

Runs only for a food with no FDA or FoodKeeper range, once per food, never per item.

1. After `saveParsed` or `addManual` creates or uses such a food, schedule the internal action `shelfLifeWeb.lookup({ foodId })`. It sets `foods.webLookupAt` so a food is looked up once.
2. The action calls the official `apify/rag-web-browser` actor through Apify's `run-sync-get-dataset-items` REST endpoint with `fetch` (no new library). Input: `query` set to `"<food name>" shelf life refrigerator`, `maxResults: 3`, `outputFormats: ["markdown"]`. The API token goes in `APIFY_TOKEN` on each Convex deployment (`npx convex env set APIFY_TOKEN <token>` from `web/`). The Apify user ID is not needed.
3. Drop results whose URL is not on an allowlist: `stilltasty.com`, `fsis.usda.gov`, `fda.gov`, `foodsafety.gov`, and university extension sites (`.edu`).
4. Send the remaining pages to Gemini with a schema that returns, per location: `minDays`, `maxDays`, `basis` (`from_purchase`, `unopened`, or `after_opening`), the `url`, and a verbatim `quote` of the sentence the numbers came from.
5. Reject any answer whose `quote` does not appear word for word in that page's markdown. This keeps the model from inventing a number.
6. Save what passes:
   - `basis: "from_purchase"`, or `unopened` on a food without a printed date (`hasPrintedDate: false`, such as deli or bakery items): store as a range with `source: "web"` and `ref: "<url> > <quote>"`. `expiryFor` then dates new items at purchase plus `min`, like every other range.
   - `basis: "after_opening"`, or any basis on a food with `hasPrintedDate: true`: store as a storage tip with source `web` ("Once opened, use within 5 to 7 days."). Do not date the item from it. The item keeps `checkLabel: true`, and the printed date stays the user's job.
7. Existing undated items of that food get a date only while they are still `draft`. Confirmed items are left alone, so a date never appears silently on something the user already reviewed.
8. The UI labels web values "Estimate from <site>", next to the FDA and FoodKeeper labels.
   Verify: for `energy drink`, `sour cream`, and `instant noodles`, the lookup either stores a range or tip with a URL and quote that match the page, or stores nothing. No `fda_chart` or `foodkeeper` range changes. A lookup with no `APIFY_TOKEN` fails quietly and leaves the food undated.

Cost and speed: `apify/rag-web-browser` is listed at $1.33 per 1,000 fetched pages and takes about 16 to 30 seconds per query. The lookup runs in the background after a parse, so the review screen does not wait for it. Gemini fills in the date while the user is still reviewing.

## Part C: Recipes for use-soon items (about 2 to 3 hours)

This moves the recipe feature from p3 into P1 because it uses both sponsors. It replaces the LLM-generated approach in p3.

1. Action `recipes.suggest()` takes the user's `items.useSoon` (from p1-03), picks the two or three items expiring first, and runs `apify/rag-web-browser` with a query like `recipe ground beef spinach`, `maxResults: 5`.
2. Gemini reads the pages and returns up to 3 recipes: title, source URL, the expiring items each one uses, and a one-line reason. It may only return recipes from the fetched pages, with their real URLs.
3. Cache the result per user per day in a `recipeSuggestions` table, so opening the screen does not start a new Apify run.
   Verify: with the demo seed, `recipes.suggest` returns recipes whose URLs open real recipe pages that mention at least one of the user's expiring items.

## Part D: GoDaddy domain (about 30 minutes, needs a human)

1. A team member buys the domain on GoDaddy. This is a purchase; a coding agent does not do it.
2. Add the domain in Vercel (Project, Settings, Domains) and copy the DNS records Vercel shows into GoDaddy's DNS settings.
3. Set `SITE_URL` on the production Convex deployment to the new domain, so auth redirects use it.
   Verify: the domain serves the app over HTTPS and sign-in works on it.

## Validation

- `npm run lint`, `npm run typecheck`, and `npm test` pass. New pure logic (quote matching, basis rules) lives in `lib/` with tests.
- Part A scores at least 80% on the p1-02 receipt check, the same bar p1-02 used.
- No item gets an `expiresAt` from a web value that lacks a stored URL and a verbatim quote.
- FDA and FoodKeeper ranges are never overwritten by web values.

## Decision log

- 2026-10-24: Apify store-product scrapers (Costco, Trader Joe's, Safeway) are not used for expiry. Product pages carry no shelf life or printed date. A Costco item-number lookup could improve food matching, but p1-02 already matches 33 of 36 lines, and Costco runs on Apify succeed 84% of the time.
- 2026-10-24: Web shelf-life comes from general shelf-life pages through `apify/rag-web-browser`, limited to an allowlist of sites, and only for foods with no FDA or FoodKeeper range.
- 2026-10-24: Web numbers count from the purchase date only when the page gives a from-purchase or unopened figure for a food with no printed date. For packaged goods the web figure is usually "past the printed date" or "after opening", and counting it from purchase would overstate how long the food lasts.

## Open questions

See README questions 8 (web as a shelf-life source) and 9 (Gemini replacing Claude). Also check stilltasty.com's terms of use before launch; the plan uses it for the demo.
