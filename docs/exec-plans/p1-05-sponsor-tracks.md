# P1-05: Sponsor tracks (Apify, Gemini, GoDaddy)

Tier: P1 (the hackathon judges these tracks). Depends on p1-02. Status: parts A and B built; part C moved to p3; part D (domain) not started.

## Purpose

`docs/design_tracks.pdf` lists the tracks the team is entering: Apify, Gemini, Convex, GoDaddy, People-First Social Impact, Best Planet-First Hack, and Figma Best Design. This plan puts each sponsor technology where it does real work in Freshly:

- Apify fetches web pages: shelf-life guidance for packaged foods the FDA chart and FoodKeeper do not cover. Recipes, store prices, and recall alerts are planned for P2 and P3.
- Gemini reads what Apify fetches and checks receipts: it extracts the shelf-life passage from a page and reads each receipt's store, date, and total a second time.
- GoDaddy holds the project's domain.

The tracks doc puts it as "apify gets data, gemini interprets it". This plan keeps that split.

## Track map

| Track | Where it fits | Plan |
| --- | --- | --- |
| Apify | Web shelf-life lookup (part B); later, recipes (p2-04), and recall alerts and store prices (p3) | This plan, p2-04, p3 |
| Gemini | Receipt header check (part A); shelf-life extraction (B); later, recipe cards from web pages (p2-04) | This plan, p2-04 |
| Convex | Already the backend: file storage for receipt photos, actions that call Gemini and Apify, the scheduler that runs lookups after a parse | p1-01, p1-02, this plan |
| GoDaddy | Domain for the Vercel deployment (part D) | This plan |
| People-First Social Impact | Food safety for students: sourced dates, storage tips, "looks spoiled?" card | p1-02, p1-03; pitch only |
| Best Planet-First Hack | Food waste measured in dollars and pounds | p1-03 waste stats; pitch only |
| Figma Best Design | Mascot and UI | Design work, no plan |

## Context

- Every model call goes through `askJson` in `convex/model/claude.ts`. It has three callers: `receiptsNode.parse`, `receiptsNode.addManual`, and `foods.backfillTips`. Switching providers means changing one helper and its content blocks, not three features.
- `foods` rows carry shelf-life ranges as `{ min, max, source, ref }`. `source` is `fda_chart` or `foodkeeper`. Of the 704 reference rows, 43 have no range at all (for example sour cream, pudding, soda, boxed juice). Every food Claude creates from a receipt line (for example `energy drink`, `instant noodles`) also has none. Those are the foods part B targets.
- `CLAUDE.md` allowed shelf-life numbers only from the FDA chart or FoodKeeper. Part B adds `web` as a third source for packaged foods (open question 8, answered).
- Store product pages (Costco, Trader Joe's, Safeway) do not list shelf life or expiry dates, because the printed date differs per package. Apify scrapers for those stores return name, brand, price, and specs only. See the Decision log.

## Part A: Gemini as the model provider (about 3 hours)

1. Set `GEMINI_API_KEY` with `npx convex env set`. Add `LLM_PROVIDER` (`gemini` or `anthropic`, default `gemini`) and `GEMINI_MODEL` (default `gemini-3.8-flash`; confirm the ID on the Gemini models page before coding).
2. Move the provider-neutral parts of `convex/model/claude.ts` (schemas, prompts) into `convex/model/llm.ts`. Keep `askJson` as the one entry point and have it dispatch on `LLM_PROVIDER`. The Gemini branch (`convex/model/gemini.ts`) calls the REST `generateContent` endpoint with `fetch`, sends images and PDFs as inline data parts, and passes the schema as `responseJsonSchema` with `responseMimeType: "application/json"`.
3. Keep the Anthropic branch working, so the team can switch back with one env var if Gemini scores worse.
   Verify: re-run the p1-02 live checks (Surprises, steps 1 to 6) with `LLM_PROVIDER=gemini`. Record the score next to Claude's 36 of 36 names and prices and 33 of 36 food matches.

Changed the same day, after the live check (see Decision log): Claude is the default again and Gemini verifies the receipt header.

4. `LLM_PROVIDER` defaults to `anthropic`; `gemini` makes Gemini the main parser.
5. After a successful parse, `receiptsNode.parse` schedules `receiptsNode.verify`. It sends the same file to Gemini with `HEADER_SCHEMA` (store, date, total only), and `receipts.saveVerification` compares the two readings with `headerMismatches` in `lib/receiptCheck.ts`. A disagreement adds `store_mismatch`, `date_mismatch`, or `total_mismatch` to `receipts.reviewFlags` for the review screen. It never changes a date. Any Gemini failure, including a missing key, saves `verification.status: "skipped"` with the error.
6. `saveParsed` checks the main parser's date with `purchaseDate` in `lib/receiptCheck.ts`. A date in the future or more than 60 days before upload is replaced with the upload time and flagged `implausible_date`.
   Verify: a parse with a 2023 date dates its items from the upload time and has `reviewFlags: ["implausible_date"]`; a Gemini reading with a different date adds `date_mismatch`; a Gemini 429 leaves the parse untouched with `verification.status: "skipped"`.

`GEMINI_API_KEY` is optional. Without it every receipt parses with Claude and the check is skipped.

## Part B: Web shelf-life lookup with Apify and Gemini (built 2026-10-24)

Leo answered open question 8 on 2026-10-24: packaged foods may take web figures, stored as their own source next to FDA and FoodKeeper. `CLAUDE.md` now says so.

Runs only for a packaged food (`hasPrintedDate: true`) with no FDA or FoodKeeper range in any location (`needsWebLookup` in `lib/webShelfLife.ts`), once per food, never per item.

1. `saveResult` (receipt parse) and `itemEdits.insertManual` call `scheduleWebLookup`, which starts `shelfLifeWeb.lookupNext` when any of their foods qualifies. `lookupNext` claims one food at a time with `claimNext` (it sets `foods.webLookupAt`, so a food is searched once and two chains never search the same food), then schedules itself for the next one. Run `npx convex run shelfLifeWeb:lookupNext` to backfill existing foods.
2. Search: the official `apify/rag-web-browser` actor through `run-sync-get-dataset-items` with `fetch` (no new library), query `"<food name> site:stilltasty.com"`, `maxResults: 5`, `scrapingTool: "raw-http"`, 2 GB per run. Token in `APIFY_TOKEN` (`npx convex env set APIFY_TOKEN <token>` from `web/`; the Apify user ID is not needed). Without the token the lookup logs and does nothing.
3. Only pages on the allowlist reach the model: `stilltasty.com`, `usda.gov`, `fda.gov`, `foodsafety.gov`, and their subdomains (`allowedSite`).
4. Extraction: Gemini reads the pages with `WEB_SHELF_LIFE_SCHEMA` and returns, per figure, `location`, `basis` (`unopened`, `after_opening`, `past_printed_date`, or `from_purchase`), `minDays`, `maxDays`, `url`, and a `quote` copied from the page. If Gemini fails (429, 503, no key), Claude does the same call.
5. `pickWebRanges` drops a figure whose page is not one of the fetched pages, whose site is not allowlisted, whose quote is not on the page word for word (`quoteOnPage`, ignoring markdown, image markup, case, and line breaks), or whose numbers are out of range. Per location it keeps a sealed figure over an after-opening one, and the shortest of those.
6. `saveRanges` stores each range with `source: "web"` and `ref: "<url> > <basis> > \"<quote>\""`. It fills only empty locations and never touches an FDA or FoodKeeper range. It then dates this food's undated `draft` and `active` items with `expiryFor` (`expirySource: "web"`). An item with a date already, including one the user typed, keeps it.
7. The item keeps `checkLabel: true`, so the review screen still asks for the printed date. The UI labels web dates "Estimate from <site>" (frontend work, not built).
   Verify: on a local deployment, sour cream (FoodKeeper has no range) got fridge 7 to 14 days from the StillTasty page "SOUR CREAM - UNOPENED PACKAGE", quoting "Sour cream will generally keep for one to two weeks after the \"sell-by\" date on the package". A manual add of "shin ramyun instant noodle cup" created the packaged food `instant noodle cup` and started a lookup on its own; StillTasty only returned soup-mix and noodles-and-sauce-mix pages, and the model returned no figure, so the item stays undated. `saveRanges` dated an undated `active` item at purchase plus `min` and did not overwrite on a second call.

Cost and speed: `apify/rag-web-browser` is listed at $1.33 per 1,000 fetched pages; one lookup took 10 to 90 seconds. It runs in the background, so the review screen does not wait for it.

## Part C: Recipes for use-soon items (moved to p3)

Moved to the recipe section of `p3-integrations.md` on 2026-10-24, with the backend sketch. The team is finishing P1 first, and recipes are P3 in the spec. Two other Apify ideas went the same way: estimated store prices for unpriced items (p2) and food recall alerts (p3). Later the same day, recipes moved up to `p2-04-recipe-suggestions.md` and store prices moved down to p3.

## Part D: GoDaddy domain (about 30 minutes, needs a human)

1. A team member buys the domain on GoDaddy. This is a purchase; a coding agent does not do it.
2. Add the domain in Vercel (Project, Settings, Domains) and copy the DNS records Vercel shows into GoDaddy's DNS settings.
3. Set `SITE_URL` on the production Convex deployment to the new domain, so auth redirects use it.
   Verify: the domain serves the app over HTTPS and sign-in works on it.

## Progress

- [x] Part A (2026-10-24: Gemini provider built and scored, see Surprises; then Claude made the default again, with Gemini as the header verifier and the receipt date guard)
- [x] Part B (2026-10-24: web ranges for packaged foods; see Part B and Surprises)
- [ ] Part C, moved to p3 (2026-10-24)
- [ ] Part D

## Validation

- `npm run lint`, `npm run typecheck`, and `npm test` pass. New pure logic (quote matching, basis rules) lives in `lib/` with tests.
- Part A scores at least 80% on the p1-02 receipt check, the same bar p1-02 used.
- No item gets an `expiresAt` from a web value that lacks a stored URL and a verbatim quote.
- FDA and FoodKeeper ranges are never overwritten by web values.

## Decision log

- 2026-10-24: Apify store-product scrapers (Costco, Trader Joe's, Safeway) are not used for expiry. Product pages carry no shelf life or printed date. A Costco item-number lookup could improve food matching, but p1-02 already matches 33 of 36 lines, and Costco runs on Apify succeed 84% of the time.
- 2026-10-24: Web shelf-life comes from general shelf-life pages through `apify/rag-web-browser`, limited to an allowlist of sites, and only for foods with no FDA or FoodKeeper range.
- 2026-10-24: Web numbers count from the purchase date only when the page gives a from-purchase or unopened figure for a food with no printed date. For packaged goods the web figure is usually "past the printed date" or "after opening", and counting it from purchase would overstate how long the food lasts.

- 2026-10-24: Gemini is called through REST with `fetch` instead of `@google/genai`. No new dependency, and it runs in Convex's default runtime, which `foods.backfillTips` uses.
- 2026-10-24: The Gemini branch retries 429 and 5xx responses three times with backoff (4, 8, and 16 seconds). Claude's branch already had server-side fallback, and Gemini has no equivalent.

- 2026-10-24: Claude stays the main receipt parser and Gemini verifies the header, decided by Leo. Gemini matched fewer foods (30 of 36 against 33), misread a year once, and the team may not get a paid Gemini key. The free tier's 20 requests a day covers one header check per receipt for a demo. Free-tier prompts may be used by Google to improve its products, so the full receipt photo goes to Gemini only on test receipts until there is a paid key or the photo is cropped to its header.
- 2026-10-24: Recipes (part C), estimated store prices, and recall alerts are P2 and P3 work, decided by Leo so the team finishes P1 first. They are written up in `p2-social-and-shopping.md` and `p3-integrations.md`.
- 2026-10-24: A header mismatch only flags the receipt. Correcting the date is the user's call on the review screen, through `receipts.setPurchasedAt({ receiptId, date })`, with `date` as `YYYY-MM-DD` (test route `GET /api/receipts/set-purchased-at?id=&date=2026-10-15`). It re-dates every draft with `expiryFor` from its sourced range, keeps an `expiresAt` the user typed (`expirySource: "user"`), clears `implausible_date` and `date_mismatch`, and rejects a date in the future. Confirmed items keep their dates.

- 2026-10-24: Gemini's date is ignored when it fails the same plausibility check as the main parser's (`verifierMismatches` in `lib/receiptCheck.ts`). In the end-to-end run on `main`, Gemini read the year as 2020 on both test receipts while Claude read 2026, so both got a false `date_mismatch`. Store and total are still compared, and a plausible date that disagrees still flags. Gemini's raw reading stays in `verification.purchasedAt`.
- 2026-10-24: A printed receipt date is stored as noon of that day in the user's timezone (`receiptDayToMs`), not midnight UTC. Midnight UTC is the previous evening in U.S. timezones, so every receipt-dated item showed one day early (ground beef bought 10/06 showed "good until 10/06" instead of 10/07). The purchase time is unknown; noon keeps the printed day in every timezone and counts days from inside the purchase day, as manual add does from the moment of entry. `setPurchasedAt` now takes the day as `YYYY-MM-DD` so the server applies the same rule. Receipts already saved keep their old dates.

## Surprises

- 2026-10-24: Live parse with `gemini-3.8-flash` on a local deployment, second run: 36 of 36 expected lines came back with the right display name and price, no extra lines, no voided, CRV, or alcohol lines, and Gold Kiwi at 1199 cents. Store, date, and total match on all three receipts. Food matches: 30 of 36, against Claude's 33. Gemini picked an existing row where the expected file creates a new food (Sugar-free Red Bull went to the soda row, Korean noodles to `pasta, dry, without eggs`), and it disagreed on near neighbors (snickerdoodles went to `cookies, soft`, keto granola to `granola`, lychee nectar to the nectar row, pumpkin bread mix to `muffin, mix, dry, commercially packaged`).
- 2026-10-24: On the first run, Gemini read the Trader Joe's date as 2023-10-15 instead of 2026-10-15. Every item from that receipt would have been dated three years in the past. The second run read it correctly. `saveParsed` trusts the model's date as given.
- 2026-10-24: Gemini returned 503 "high demand" on 2 of the first 3 parses and on 1 manual add even after three retries. Parses took 30 to 60 seconds each, a manual add that needs the model about 20 seconds, and a `backfillTips` batch of 25 about 90 seconds.
- 2026-10-24: The test key is on Gemini's free tier, which allows 20 `gemini-3.8-flash` requests per day. Six parses, a few manual adds, and six `backfillTips` batches used all of them, and every later call failed with 429 for about 20 hours. A demo needs a billed key. The retry loop also retries this daily-quota 429, which cannot succeed.
- 2026-10-24: `gemini-3.5-flash-lite` answers a manual add in 1 to 2 seconds, but it created new foods for "sriracha mayo" and "ube cheesecake" instead of matching existing rows. The default stays `gemini-3.8-flash`.
- 2026-10-24: `manualSystemPrompt` and `receiptSystemPrompt` worked on Gemini unchanged, and so did the JSON schemas (`anyOf` with `null`, `additionalProperties: false`, `format: "date"`).

- 2026-10-24: Searching every allowed site at once (`site:a OR site:b ...`) and `site:edu` returned mostly unusable pages, and `.edu` results included SEO spam hosted on university subdomains (a "sriracha mayo" product listing on a `columbia.edu` sandbox). `.edu` is off the allowlist and the query targets StillTasty, which has a page per packaged food.
- 2026-10-24: StillTasty pages are laid out as heading, location, figure ("SOUR CREAM - UNOPENED PACKAGE / Refrigerator / 10-14 days after date on package") with image markup between them, so the quote check drops image and link markup before comparing.
- 2026-10-24: Apify caps all of an account's runs at 16 GB, and `rag-web-browser` defaults to a large share, so three runs at once failed with `actor-memory-limit-exceeded`. Runs now ask for 2 GB.
- 2026-10-24: Of 6 local candidates, 2 got a range (sour cream; pudding, from StillTasty's homemade-pudding page, which the prompt asks the model to skip but which is shorter than a commercial pudding cup). Oat milk, tteokbokki rice cakes, sriracha mayo, and ube cheesecake have no StillTasty page and stay undated. The same query can return different pages on different runs.

## Open questions

See README questions 8 (web as a shelf-life source) and 9 (Gemini replacing Claude). Also check stilltasty.com's terms of use before launch; the plan uses it for the demo.
