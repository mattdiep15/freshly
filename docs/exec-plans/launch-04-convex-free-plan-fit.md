# Launch-04: Fitting Convex's free plan

Tier: Launch. Estimate: 3 to 4 hours for one engineer. Overview: [launch-00-free-tier-overview.md](launch-00-free-tier-overview.md).

## Purpose

Convex stays as the database and backend. Its free plan has hard caps per team per month: 1M function calls, 0.5 GB of database storage, 1 GB of database I/O, 1 GB of file storage, 1 GB of file egress, and 20 GB-hours of action compute. When a cap is reached, writes can fail until the month resets, and there is no overage to pay instead. Database I/O is the cap Freshly would hit first, because several functions read the whole `foods` table. This plan cuts those reads and deletes receipt files after use.

## Context

State on 2026-10-26:

- `foods` holds about 700 rows (FDA chart, FoodKeeper, and model-added foods) with tips, hints, and `ref` quotes. Our estimate is about 0.5 to 1 MB per full read; the dashboard's Usage page shows the real I/O per function.
- Functions that read every `foods` row:
  - `foods.catalog` (`convex/foods.ts:115`, capped at `CATALOG_LIMIT`), subscribed from three components for manual-entry autocomplete. It reruns for every subscribed client whenever any food changes, which happens once per food during a web lookup chain.
  - `receipts.parseInput` (`convex/receipts.ts:175`), once per receipt, for the food-name list sent to the model.
  - `itemEdits.manualInput` (`convex/itemEdits.ts:57`), once per manual add.
  - `shelfLifeWeb.claimNext` (`convex/shelfLifeWeb.ts:36`), once per food in a lookup chain. A full backfill of 674 foods is 674 full reads, roughly 0.3 to 0.7 GB, most of a month's I/O.
  - `foods.missingTips` (`convex/foods.ts:144`), once per batch of 25 in `backfillTips`.
- `lifecycle.tick` reads every profile every hour (`TODO(release)` in `convex/lifecycle.ts`; p2-05 step 4).
- Receipt images stay in Convex file storage after parsing. Only `seed.ts` deletes them.
- Function calls: subscriptions rerunning count as calls. At roughly 100 calls per active user per day, 1M a month covers about 300 daily active users.

## Steps

1. Baseline. Open the prod and dev deployments' Usage pages and write down database I/O, function calls, file storage, and action compute by function for the last 30 days in the Decision log.
2. Food name index. Add a `foodNames` table with one small row per food: `foodId`, `name`, `aliases`, `category`, and the min, max, and source of each range. `importReferenceFoods`, `saveTips`, `shelfLifeWeb.saveRanges`, and the code that inserts model-added foods keep it in sync. Point `catalog`, `parseInput`, and `manualInput` at it. A tip or quote change no longer touches it, so `catalog` stops rerunning during lookup chains.
   Verify: the Usage page shows `foods.catalog` I/O falling by most of its size after a day of use, and autocomplete still shows ranges.
3. Lookup queue by index. Add an optional `webLookupNeeded` field to `foods` with an index, set where `needsWebLookup` is true today, and have `claimNext` take the first row from the index instead of collecting the table. Do the same for `missingTips` with a `tipsMissing` flag, or leave it, since it runs only during setup.
   Verify: one `claimNext` call reads one row, shown in the function's I/O on the Usage page.
4. Delete receipt files. In `receipts.confirmDrafts`, delete the receipt's file from storage once its drafts are confirmed, and in the hourly tick, delete files of receipts left unconfirmed for 7 days. Keep the `receipts` row for history. This also limits how long we hold images with card digits, which the privacy page in launch-01 can then state.
   Verify: after confirming a receipt on dev, the dashboard's Files page no longer lists its file.
5. Due-hour index for the tick. Do p2-05 step 4 here if p2-05 has not started: store each profile's due UTC hour and read only those profiles.
6. Usage check. Add a monthly calendar reminder for whoever owns the Convex team to read the Usage page, and add the free caps to `docs/ARCHITECTURE.md` next to the env var table.

## Alternatives considered

Moving to another free database would replace Convex's queries, mutations, scheduler, crons, file storage, auth, and the WebSocket updates that keep pages current without polling. That is a rewrite of every file in `convex/` and every data hook in `app/`. Supabase's free plan pauses projects after a week with no activity, and Firebase's free plan has its own daily read caps, so neither removes the need to watch usage. Staying on Convex and reading less costs a few hours.

## Validation

- A week of dev use with two or three testers keeps database I/O under 50 MB on the Usage page.
- Receipt files older than a confirmed parse are gone from storage.
- `npm test` covers any new `lib/` helper.

## Decision log

- 2026-10-26: Keep Convex on the free plan; fix full-table reads before launch.
