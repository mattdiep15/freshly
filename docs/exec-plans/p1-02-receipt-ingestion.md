# P1-02: Receipt ingestion and expiry dates

Tier: P1. Estimate: 4 to 5 hours for one engineer. Depends on p1-01. Can run in parallel with p1-03.

## Purpose

A user photographs a grocery receipt (or uploads a PDF of one) and gets back a list of fridge items. Each item has an expiry date from sourced shelf-life data, a storage tip, and a freshness hint. The user reviews the list, fixes anything wrong, and confirms. Items with no sourced shelf life come back without a date, and the UI asks the user to set one. A user can also add a single item by typing its name.

This covers "Food spoilage tracker" in `docs/PRODUCT.md` (receipt scan, manual entry, expiry lookup, storage recommendations for unfamiliar foods) and the freshness hints from "Food reminder system", since those hints live on the same `foods` rows.

## Context

- Schema, `getUserId`, the `foods` table, and the `/api` route convention are defined in p1-01. Read that first, and read the "Food safety data" section of `CLAUDE.md`.
- The product spec says "look up receipt SKUs in known databases". The test receipts in `data/` show why that does not work directly. The Costco receipts print Costco's own item numbers (for example `47355 GROUND BEEF`), which no public product database indexes, and the Trader Joe's receipt prints no item numbers at all. This plan uses Claude to read the receipt and map each line to a row in `foods` instead. See the Decision log.
- The `foods` table is small enough (a few hundred names) to send in full with every parse request. That turns matching into a pick-from-list task, and the server only has to check that the returned name exists.
- Claude reads receipts and matches names. It never supplies shelf-life numbers. Those come only from `foods` ranges sourced from the FDA chart or FoodKeeper.

## Test receipts

Three real receipts are in `data/`. They are not committed to git yet, because they show Costco member numbers, the last four digits of payment cards, and cashier names. Ask the team before committing them, since the repo has a GitHub remote.

| File | What it tests |
| --- | --- |
| `costco_test_1.jpeg` | Long receipt with the header cut off (no store name or date). VOID lines that cancel earlier lines, instant-savings lines (`/ 6995  3.00-`) that discount an earlier item, CRV deposit lines (`CA REDEMP VA`), alcohol, and duplicate items (two `GROUND BEEF`, two `KS MANGO`). |
| `costco_test_2.jpeg` | Short, clean receipt with a date (10/06/2026). Ground beef, cheese, buns, an energy drink, seasoning. |
| `tj_test_1.pdf` | A PDF containing a photo. Quantity lines (`2 @ $3.99`), truncated names (`HOL PUMPKIN SPICE SNICKE`), eggs and butter. Dated 10-15-2026. |

Line rules for the parse prompt, taken from these receipts:

- Skip tax, totals, payment lines, CRV deposits, bags, and alcohol.
- A VOID line cancels the matching earlier line. Drop both.
- A discount line (`/ <item number>` with a negative amount) reduces that item's price.
- Keep repeated lines as separate items. Merging them is a UI choice.
- Do not extract member numbers, card digits, or cashier names.

## Flow

1. Client calls `receipts.generateUploadUrl`, uploads the photo or PDF to Convex storage, then calls `receipts.create({ fileId, fileType })`.
2. `receipts.create` inserts a receipt with status `uploaded` and schedules the internal action `receipts.parse` to run immediately.
3. `receipts.parse` sets status `parsing`, loads the file and the list of food names, and makes one Claude Messages API call. Images go in an image block, PDFs in a document block. A forced tool call (`record_receipt`) returns structured JSON.
4. The internal mutation `receipts.saveParsed` creates `foods` rows for unmatched names (no shelf-life ranges), inserts one `draft` item per food line, and sets the receipt to `parsed`. On any error it sets `failed` with a message.
5. The client shows the drafts (the `receipts.get` query updates live as status changes). The user edits or removes lines and calls `items.confirmDrafts`, which flips drafts to `active` and bumps `foodFamiliarity`.

### `record_receipt` tool output

```ts
{
  storeName: string | null,
  purchasedAt: string | null,      // ISO date printed on the receipt
  totalCents: number | null,
  lines: Array<{
    rawText: string,               // "47355 GROUND BEEF"
    displayName: string,           // "Ground beef"
    quantity: number,
    unit: string | null,
    priceCents: number,            // after any discount line
    weightGrams: number | null,    // printed weight if present, else a rough estimate
    foodName: string | null,       // exact entry from the provided foods list, or null
    newFood: null | {              // when foodName is null
      name, category, defaultLocation, defaultWeightGrams,
      storageTip, freshnessHint,   // stored with source "llm"
    },
  }>,                              // food lines only; skipped lines are left out
}
```

### Expiry rule

Pure function `expiryFor(food, location, purchasedAt)` in `lib/expiry.ts`, with tests:

- Use the food's range for `location`, or its fridge range if that location has none.
- `expiresAt = purchasedAt + range.min` days. The low end of the range is used because these are safety claims.
- Return `{ expiresAt, expirySource: range.source }`, or `null` when no sourced range exists. The item is then stored with no `expiresAt`, and the UI shows "No sourced shelf life. Set a date."
- `purchasedAt` is noon of the receipt date in the user's timezone (`profiles.utcOffsetMinutes`), or the upload time when the receipt has none (`costco_test_1.jpeg`). Changed 2026-10-24, see p1-05 Decision log.

### Storage tips for unfamiliar foods

The product spec asks for an "Anki/Duolingo" feel: teach storage for foods the user does not know yet, then stop repeating it. For P1, `items.get` and `items.list` return `showTip: true` while the user's `foodFamiliarity.tipViews` for that food is below 3. The client calls `foods.ackTip({ foodId })` when the tip is dismissed. Real spaced repetition, with tips coming back after a gap, is left for later.

Tips and hints carry their source. When the source is `"llm"`, the UI labels them as general guidance. See open question 3 in the README.

## File ownership while p1-03 runs in parallel

These override the module names in the steps below (2026-10-23). p1-03 owns `convex/items.ts` (`items.get`, `items.list`, and the item shape with `storageTip`, `freshnessHint`, `showTip`), so this plan's item functions live elsewhere:

| Plan text | Built as |
| --- | --- |
| `items.confirmDrafts` | `receipts.confirmDrafts` in `convex/receipts.ts` |
| `items.update` | `itemEdits.update` in `convex/itemEdits.ts` |
| `items.addManual` | `receiptsNode.addManual` in `convex/receiptsNode.ts` (`"use node"`, next to `parse`) |
| `receipts.parse` | `receiptsNode.parse` |
| `data/<name>.expected.json` | `convex/data/receipt-fixtures/<name>.expected.json` (committed; names and prices only) |
| `/api/items/...` routes | `/api/receipts/...`, `/api/item-edits/...`, `/api/foods/...` |

## Progress

- [x] 1. Expected results for the test receipts (2026-10-23: 22, 7, and 7 lines; each line also carries the `foodName` or `newFood` a correct parse should return, so the file doubles as the mock payload)
- [x] 2. `lib/expiry.ts` and its tests (2026-10-23: 5 tests)
- [x] 3. Upload and receipt mutations
- [x] 4. Parse action with Claude (2026-10-24: live parse of all three receipts, see Validation)
- [x] 5. Save parsed lines as drafts
- [x] 6. Confirm, edit, set date, and manual add (2026-10-24: `addManual` takes an optional `expiresAt`)
- [x] 7. Storage tips and familiarity (2026-10-23: `foods.ackTip` only; `showTip` in `items.get` and `items.list` belongs to p1-03)
- [x] 8. Backfill tips and hints for reference foods (2026-10-24: all 675 foods have a tip and a hint)
- [x] 9. `/api` test routes

## Steps

1. For each receipt in `data/`, write `data/<name>.expected.json` by hand: the food lines that should survive the line rules, with display name and final price in cents.
   Verify: `costco_test_1.expected.json` has no Rice Krispies or pepperoni pizza (both voided), no vodka or seltzer, and Gold Kiwi at 1199 cents (14.99 minus the 3.00 discount).

2. Write `lib/expiry.ts` and `lib/expiry.test.ts`. Cover: fridge range used by default; freezer range when location is freezer; fallback to fridge when the location has no range; `null` when no range exists; the low end of the range is used.
   Verify: `npm test` passes.

3. In `convex/receipts.ts`, add `generateUploadUrl` (mutation, returns `ctx.storage.generateUploadUrl()`), `create({ fileId, fileType })`, and `get({ receiptId })` returning the receipt plus its draft items. All three call `getUserId` and check ownership.
   Verify: in the Convex dashboard, `receipts.create` with an uploaded file id inserts a row with status `uploaded`.

4. Run `npm install @anthropic-ai/sdk` and set `ANTHROPIC_API_KEY` with `npx convex env set`. Write `convex/receiptsNode.ts` with `"use node"` and the internal action `parse({ receiptId })`. Read the model from the `RECEIPT_MODEL` env var, defaulting to `claude-sonnet-5-5`. Send the file, the foods name list and the line rules in the system prompt, and `tool_choice` forcing `record_receipt`. `costco_test_2.jpeg` is 2.8 MB at 3024x4032, so check it against the API's per-image limits. The frontend should downscale photos to about 1600 px on the long edge before upload, and `parse` should fail with a clear error on oversized files.
   Verify: running `parse` on each test receipt logs lines that match its expected file.

5. Write the internal mutation `receipts.saveParsed({ receiptId, result })`. For each line, look up `foodName` with the `by_name` index. If the model returned a name that is not in the table, treat it as null. For `newFood`, upsert by `name`. The new row has no shelf-life ranges and has its tip and hint stored with `source: "llm"`. Insert `draft` items using `expiryFor`.
   Verify: parsing both Costco receipts leaves one `foods` row for ground beef, and its items have `expirySource: "fda_chart"`.

6. In `convex/items.ts`, add:
   - `confirmDrafts({ receiptId, removeItemIds })`: deletes removed drafts, flips the rest to `active`, increments `foodFamiliarity.timesAdded`.
   - `update({ itemId, name?, quantity?, location?, expiresAt? })`: if `location` changes and `expiresAt` is not given, recompute with `expiryFor`. A user-set `expiresAt` sets `expirySource: "user"`.
   - `addManual({ name, quantity?, location?, priceCents?, expiresAt? })`: a public action that matches one typed name to `foods` with the same Claude prompt (text instead of a file), then inserts an `active` item with `purchasedAt` set to now and `expiresAt` from `expiryFor`. A given `expiresAt` wins and sets `expirySource: "user"`. Design v2 makes manual entry the second input path (P1.5 in the spec), not only a demo fallback, so it needs its own screen next to the scan flow.
   Verify: moving ground beef from fridge to freezer pushes its `expiresAt` out by months, `update` with an `expiresAt` on an undated item makes it show up in `useSoon`, and `addManual` with "spinach" returns an item with `expirySource: "foodkeeper"`.

7. Add `foods.ackTip({ foodId })` and include `storageTip`, `freshnessHint` (each with its source), and `showTip` in the item shape returned by `items.get` and `items.list`.
   Verify: after three `ackTip` calls on a new food, `items.get` returns `showTip: false`.

8. Write an internal action `foods.backfillTips` that finds foods missing `storageTip` or `freshnessHint` and fills them in batches of 25 per Claude call, stored with `source: "llm"`. It never writes shelf-life ranges. Run it once after the p1-01 import.
   Verify: no `foods` row is missing a `freshnessHint`, and no row gained a shelf-life range.

9. Add `/api` routes following p1-01:
   - `GET /api/dev/parse-test?name=costco_test_2.jpeg`: reads the file from `data/`, uploads it, calls `receipts.create`, and returns `{ receiptId }`. Dev-only.
   - `GET /api/receipts/get?id=<receiptId>`: returns the receipt and its drafts. Refresh until status is `parsed`.
   - `GET /api/items/confirm-drafts?receiptId=<id>`: confirms all drafts.
   - `GET /api/items/update?id=<itemId>&expiresAt=2026-11-01`: sets a date by hand.
   - `GET /api/items/add-manual?name=greek%20yogurt&expiresAt=2026-11-01`: adds one item. `expiresAt` is optional.
   Verify: the full flow works from the browser address bar alone.

## Interfaces delivered

| Convex function | Kind | Test route |
| --- | --- | --- |
| `receipts.generateUploadUrl` | mutation | used by `/api/dev/parse-test` |
| `receipts.create({ fileId, fileType })` | mutation | `GET /api/dev/parse-test?name=costco_test_2.jpeg` |
| `receipts.get({ receiptId })` | query, returns the receipt plus `drafts`, each with `checkLabel` | `GET /api/receipts/get?id=` |
| `receipts.confirmDrafts({ receiptId, removeItemIds? })` | mutation | `GET /api/receipts/confirm-drafts?receiptId=&remove=id1,id2` |
| `itemEdits.update({ itemId, name?, quantity?, location?, expiresAt? })` | mutation | `GET /api/item-edits/update?id=&expiresAt=2026-11-01&location=freezer` |
| `receiptsNode.addManual({ name, quantity?, location?, priceCents?, expiresAt? })` | action | `GET /api/receipts/add-manual?name=eggs&expiresAt=2026-11-01` |
| `foods.ackTip({ foodId })` | mutation, returns `{ tipViews, showTip }` | `GET /api/foods/ack-tip?id=` |
| `receipts.devCreateParsed` | dev-only mutation, saves a fixture as the parse result | `GET /api/dev/parse-test?name=costco_test_2.jpeg&mock=1` |
| `receiptsNode.parse`, `receipts.saveParsed` | internal action, internal mutation | scheduled by `receipts.create` |
| `foods.backfillTips` | internal action | `npx convex run foods:backfillTips` |
| `items.get`, `items.list` | query | p1-03 |

`foods.TIP_VIEWS_TO_LEARN` (3) is exported for p1-03's `showTip`. `needsLabelDate(food, expirySource)` in `lib/expiry.ts` gives `checkLabel`; `items.get` and `items.list` should return it too.

## Validation

- `npm run lint`, `npm run typecheck`, and `npm test` pass.
- Across the three test receipts, at least 80% of expected food lines come back with the right display name and price. Record the actual number under Surprises.
- Voided lines, CRV lines, and alcohol never become items.
- Every item with an `expiresAt` has an `expirySource` of `fda_chart`, `foodkeeper`, or `user`. No item gets a date from the model.
- An upload that is not a receipt ends in status `failed` with a readable error, and no items are created.
- Parsing the same receipt twice creates no duplicate `foods` rows.

Result on 2026-10-24, against a local deployment on `localhost:3004`, with `claude-sonnet-5-5`:

- Lint, typecheck, and `npm test` (20 tests, after the rebase onto the `web/` layout) pass.
- Accuracy: 36 of 36 expected lines came back with the right display name and price, with no extra lines. 33 of 36 matched the same `foods` row as the expected file. The other 3 picked a defensible neighbor: organic spinach went to `bagged greens, leaf, spinach, lettuce, etc.`, lychee nectar to `nectar, papaya, mango, guava, or guavabana`, and pumpkin bread and muffin mix to `muffin, mix, dry, commercially packaged`. Store, date, and total match on all three receipts; `costco_test_1` has no store or date, so its items use the upload time.
- Voided lines, CRV, and alcohol: none came back. No Rice Krispies, pepperoni pizza, vodka, hard seltzer, soju, `BUZZ VAMP`, or `CA REDEMP VA` lines, and Gold Kiwi is 1199 cents.
- Expiry sources: passes. Matched foods get `fda_chart` or `foodkeeper`, unmatched and unsourced foods get no date, and a date set through `itemEdits.update` gets `user`. The output schema has no shelf-life field, so the model cannot supply days.
- Not a receipt: uploading `docs/food_storage_chart.pdf` through `/api/dev/parse-test` ends in `failed` with "This file doesn't look like a grocery receipt." and no items. A parse without the key ends in `failed` with "ANTHROPIC_API_KEY is not set on this Convex deployment.", and a 3.8 MB photo fails with the size message before any model call.
- No duplicate foods: four mock parses (both Costco receipts, the TJ PDF, then `costco_test_2` again) leave 675 rows: 673 reference foods plus `energy drink` and `instant noodles`, no duplicate names. Both Costco receipts point at the one `ground beef` row, and its items have `expirySource: "fda_chart"`.
- Step 6: moving ground beef bought 2026-10-24 from fridge to freezer moved `expiresAt` from 2026-10-25 to 2027-01-22. The `useSoon` half of that check waits for p1-03.
- Step 6 manual add: "greek yogurt" matched `yogurt` (FoodKeeper, 7 days), "dragon fruit" matched `pitaya/dragon fruit`, and "trader joes orange chicken" matched `frozen entrees, prepared meals` in the freezer. "spinach" got `expirySource: "foodkeeper"` without a model call.
- Step 7: three `foods.ackTip` calls return `showTip` true, true, false. `items.get` returning `showTip: false` waits for p1-03.
- Step 8: after `foods:backfillTips`, 0 of 675 rows lack a tip or hint, 0 shelf-life ranges changed, and no model-written tip or hint states a duration.
- Printed-date flag: the backfill flagged 419 of 675 foods (produce 5 of 101, dairy 42 of 43, pantry 100 of 104). On the mock `costco_test_1`, the 11 processed lines are flagged and the 11 fresh ones (produce, ground beef, salmon) are not. Setting a date on Clif bars clears its flag, and ground beef still accepts a typed date. A live parse of `costco_test_2` with the new schema flags everything except ground beef.

## Decision log

- 2026-10-23: Claude maps receipt lines to `foods` instead of a SKU lookup. Costco item numbers are store-internal and Trader Joe's prints none. If a store's receipts print UPCs, an Open Food Facts lookup can be added as a first pass later.
- 2026-10-23: One Claude call per receipt does reading and matching together. Fewer calls and one place to tune the prompt. Splitting it is the first thing to try if accuracy is poor.
- 2026-10-23: The model never supplies shelf-life numbers, per `CLAUDE.md`. Unknown foods get a `foods` row for matching, tips, and hints, but no ranges, and items made from them have no date until the user sets one.
- 2026-10-23: Accept PDFs as well as images, because one of the team's test receipts is a PDF.
- 2026-10-23: Familiarity uses a fixed count of 3 tip views. Spaced repetition is deferred.
- 2026-10-23: Structured output (`output_config.format` with a JSON schema) replaces the forced `record_receipt` tool call. `claude-sonnet-5-5` returns a 400 for a forced `tool_choice`. The payload shape is the one in "`record_receipt` tool output" plus an `isReceipt` flag, so a photo of something else fails with a readable error instead of an empty receipt.
- 2026-10-23: Every Claude call goes through `askJson` in `convex/model/claude.ts`, with `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) so a safety-classifier refusal is retried on another model instead of failing the parse. The foods list sits in a cached system prompt, since it is the same on every call.
- 2026-10-23: `addManual` checks for an exact food name or alias first and only calls Claude when there is none. It is cheaper and lets the demo add common items without a key.
- 2026-10-23: The mock path is a dev-only public mutation, `receipts.devCreateParsed`, that inserts the receipt and saves the fixture in one step. It schedules no `parse`, so a parse with no key cannot race it and mark the receipt failed. `parse` also skips any receipt that is no longer `uploaded`.
- 2026-10-23: Re-parsing a receipt deletes its earlier drafts before inserting new ones. Confirmed items stay.
- 2026-10-23: `itemEdits.update` moves an `expired` item back to `active` when it gets a future `expiresAt`, so a corrected date takes the swipe card away.
- 2026-10-23: Image limit is 3.75 MB of raw bytes, because the API's 5 MB per-image cap applies after base64 encoding. `costco_test_2.jpeg` (2.9 MB) fits. PDFs are capped at 20 MB, under the 32 MB request limit.
- 2026-10-23: Unmatched foods get `location` from the model's `newFood.defaultLocation`, else `fridge`. A line with neither a match nor a `newFood` becomes an item with no `foodId` and no date.
- 2026-10-24: Packaged goods ask for their printed date, approved by Leo. `foods.hasPrintedDate` (a new optional schema field) is true for processed products normally sold with a best-by or use-by date (snacks, drinks, sauces, cereal, baking mixes, packaged bread, cheese, yogurt, butter, frozen meals) and false for raw produce, raw meat, poultry, and fish, and eggs. Claude sets it on new foods during a parse or manual add, and `foods.backfillTips` sets it on reference foods. Such an item still gets the FoodKeeper or FDA estimate, and `receipts.get` marks it `checkLabel: true` until the user sets a date, so the UI can highlight it and ask for the date on the package. Every item, flagged or not, accepts a typed date through `itemEdits.update`; unflagged items are simply not highlighted. `foods.importReference` keeps the flag when it rewrites a row.
- 2026-10-24: Scraping store product pages with Apify to find expiry dates was considered and dropped. Costco, Trader Joe's, and Safeway pages list no shelf life or printed date. Web shelf-life lookup for unsourced foods moved to p1-05 part B.
- 2026-10-24: Design v2 marks manual entry high priority (P1.5). `addManual` stays in this plan and gains an optional `expiresAt`, so a user adding an undated food can set its date in the same step.

## Surprises

- 2026-10-24: The API accepts `RECEIPT_SCHEMA` as written (`anyOf` with `null` for optional fields).
- 2026-10-24: The printed-date backfill flagged a few fresh foods, for example `yuca/cassava`. A wrong flag only adds a prompt to enter a date; it never changes a date.
- 2026-10-24: A known food-safety bug in `itemEdits.update` (moving an expired item to the freezer gives it a new date) is recorded in `docs/bugs.md` and not fixed yet.
- 2026-10-24: `backfillTips` filled 0 foods on its second batch: the foods were sent as `name (category)` and the model returned names that no longer matched exactly. Foods are now numbered in the prompt and matched back by number. The action also does one batch of 25 per run and schedules the next, because 27 calls in one action could pass Convex's 10-minute action limit. It stops when a batch fills nothing.
- 2026-10-24: The key lives on each deployment. Setting it on the team's cloud dev deployment (`secret-opossum-432`) does not reach a worktree's local anonymous deployment.
- To re-run the live checks on another deployment:
  1. `npx convex env set ANTHROPIC_API_KEY <key>` from `web/`. Optionally set `RECEIPT_MODEL`; the default is `claude-sonnet-5-5`.
  2. Copy the test receipts into `web/data/` (never commit them). With `npm run dev` running from `web/`, open `/api/dev/parse-test?name=<file>` for `costco_test_1.jpeg`, `costco_test_2.jpeg`, and `tj_test_1.pdf`. Each returns a `receiptId`.
  3. Refresh `/api/receipts/get?id=<receiptId>` until `status` is `parsed` or `failed`. The Convex log prints each line's name and price.
  4. Compare `drafts` (`name`, `priceCents`) with `convex/data/receipt-fixtures/<file>.expected.json` and record the share of the 36 expected lines that match under this section.
  5. Run `npx convex run foods:backfillTips`, then check that no `foods` row lacks a `freshnessHint` and that no range changed.
  6. Open `/api/receipts/add-manual?name=greek%20yogurt` to check the model path of `addManual`.
- 2026-10-23: The prices on `costco_test_1.jpeg` sit about one row above their item names, because the photo is tilted. Read row by row, the prices in the top third land on the wrong items. Pairing them by order (Gold Kiwi 14.99, then the `/ 6995` 3.00 discount) matches the plan's 1199 cents. The prompt tells the model to pair prices by order and check them against the totals; the live parse got every price on this receipt right.
- 2026-10-23: `tj_test_1.pdf` carries a text layer with the receipt's text, so the model gets the text as well as the photo.
- 2026-10-23: On `costco_test_1.jpeg`, `BUZZ VAMP` (15.99, CRV, no `E` flag) is left out of the expected file as alcohol. On these Costco receipts the `E` flag marks the exempt food lines, and every line without it is alcohol or a deposit.
- 2026-10-23: The Anthropic SDK runs in Convex's default runtime, so `foods.backfillTips` lives in `convex/foods.ts` without `"use node"`.
- 2026-10-23: Each worktree's anonymous Convex deployment keeps its state in its own `.convex/`, so parallel sessions do not share data. Auth keys for this one were generated with `jose` and set with `npx convex env set`, because `npx @convex-dev/auth` is interactive. `SITE_URL` is `http://localhost:3004`.
