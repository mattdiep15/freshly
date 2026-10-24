# P1-02: Receipt ingestion and expiry dates

Tier: P1. Estimate: 4 to 5 hours for one engineer. Depends on p1-01. Can run in parallel with p1-03.

## Purpose

A user photographs a grocery receipt (or uploads a PDF of one) and gets back a list of fridge items. Each item has an expiry date from sourced shelf-life data, a storage tip, and a freshness hint. The user reviews the list, fixes anything wrong, and confirms. Items with no sourced shelf life come back without a date, and the UI asks the user to set one.

This covers "Food spoilage tracker" in `docs/PRODUCT.md` (receipt scan, expiry lookup, storage recommendations for unfamiliar foods) and the freshness hints from "Food reminder system", since those hints live on the same `foods` rows.

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
- `purchasedAt` is the receipt date, or the upload time when the receipt has none (`costco_test_1.jpeg`).

### Storage tips for unfamiliar foods

The product spec asks for an "Anki/Duolingo" feel: teach storage for foods the user does not know yet, then stop repeating it. For P1, `items.get` and `items.list` return `showTip: true` while the user's `foodFamiliarity.tipViews` for that food is below 3. The client calls `foods.ackTip({ foodId })` when the tip is dismissed. Real spaced repetition, with tips coming back after a gap, is left for later.

Tips and hints carry their source. When the source is `"llm"`, the UI labels them as general guidance. See open question 3 in the README.

## Progress

- [ ] 1. Expected results for the test receipts
- [ ] 2. `lib/expiry.ts` and its tests
- [ ] 3. Upload and receipt mutations
- [ ] 4. Parse action with Claude
- [ ] 5. Save parsed lines as drafts
- [ ] 6. Confirm, edit, set date, and manual add
- [ ] 7. Storage tips and familiarity
- [ ] 8. Backfill tips and hints for reference foods
- [ ] 9. `/api` test routes

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
   - `addManual({ name, quantity?, location?, priceCents? })`: a public action that matches one typed name to `foods` with the same Claude prompt (text instead of a file), then inserts an `active` item. This is the demo fallback when receipt parsing misbehaves.
   Verify: moving ground beef from fridge to freezer pushes its `expiresAt` out by months, and `update` with an `expiresAt` on an undated item makes it show up in `useSoon`.

7. Add `foods.ackTip({ foodId })` and include `storageTip`, `freshnessHint` (each with its source), and `showTip` in the item shape returned by `items.get` and `items.list`.
   Verify: after three `ackTip` calls on a new food, `items.get` returns `showTip: false`.

8. Write an internal action `foods.backfillTips` that finds foods missing `storageTip` or `freshnessHint` and fills them in batches of 25 per Claude call, stored with `source: "llm"`. It never writes shelf-life ranges. Run it once after the p1-01 import.
   Verify: no `foods` row is missing a `freshnessHint`, and no row gained a shelf-life range.

9. Add `/api` routes following p1-01:
   - `GET /api/dev/parse-test?name=costco_test_2.jpeg`: reads the file from `data/`, uploads it, calls `receipts.create`, and returns `{ receiptId }`. Dev-only.
   - `GET /api/receipts/get?id=<receiptId>`: returns the receipt and its drafts. Refresh until status is `parsed`.
   - `GET /api/items/confirm-drafts?receiptId=<id>`: confirms all drafts.
   - `GET /api/items/update?id=<itemId>&expiresAt=2026-11-01`: sets a date by hand.
   - `GET /api/items/add-manual?name=greek%20yogurt`: adds one item.
   Verify: the full flow works from the browser address bar alone.

## Interfaces delivered

| Convex function | Kind | Test route |
| --- | --- | --- |
| `receipts.generateUploadUrl` | mutation | used by `/api/dev/parse-test` |
| `receipts.create` | mutation | used by `/api/dev/parse-test` |
| `receipts.get` | query | `GET /api/receipts/get?id=` |
| `items.confirmDrafts` | mutation | `GET /api/items/confirm-drafts?receiptId=` |
| `items.update` | mutation | `GET /api/items/update?id=` |
| `items.addManual` | action | `GET /api/items/add-manual?name=` |
| `items.get`, `items.list` | query | shared with p1-03 |
| `foods.ackTip` | mutation | `GET /api/foods/ack-tip?id=` |

## Validation

- `npm run lint`, `npm run typecheck`, and `npm test` pass.
- Across the three test receipts, at least 80% of expected food lines come back with the right display name and price. Record the actual number under Surprises.
- Voided lines, CRV lines, and alcohol never become items.
- Every item with an `expiresAt` has an `expirySource` of `fda_chart`, `foodkeeper`, or `user`. No item gets a date from the model.
- An upload that is not a receipt ends in status `failed` with a readable error, and no items are created.
- Parsing the same receipt twice creates no duplicate `foods` rows.

## Decision log

- 2026-10-23: Claude maps receipt lines to `foods` instead of a SKU lookup. Costco item numbers are store-internal and Trader Joe's prints none. If a store's receipts print UPCs, an Open Food Facts lookup can be added as a first pass later.
- 2026-10-23: One Claude call per receipt does reading and matching together. Fewer calls and one place to tune the prompt. Splitting it is the first thing to try if accuracy is poor.
- 2026-10-23: The model never supplies shelf-life numbers, per `CLAUDE.md`. Unknown foods get a `foods` row for matching, tips, and hints, but no ranges, and items made from them have no date until the user sets one.
- 2026-10-23: Accept PDFs as well as images, because one of the team's test receipts is a PDF.
- 2026-10-23: Familiarity uses a fixed count of 3 tip views. Spaced repetition is deferred.

## Surprises

(none yet)
