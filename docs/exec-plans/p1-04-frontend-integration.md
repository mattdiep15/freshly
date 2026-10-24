# P1-04: Frontend integration

Tier: P1. Estimate: about 7 to 8 hours for one engineer. Depends on p1-01, p1-02, and p1-03, which have all merged.

## Purpose

Replace the demo fixtures behind every page with the Convex functions from p1-01 to p1-03. After this plan, a user can scan or type in groceries, see them on the home and fridge pages with sourced dates, mark them used, answer the swipe cards when they expire, and see real waste numbers on the stats page. The friends page and the fridge fullness drawing stay on demo data, because no backend exists for them yet.

This covers the "Clean, demo-ready UI" goal from Priority 1 in `docs/PRODUCT.md`, which the README listed as having no plan.

## Context

- Read `CLAUDE.md`, then the "Interfaces delivered" sections and return shapes in p1-02 and p1-03. This plan only calls those functions and adds two small backend fields (step 1).
- Other sessions were still refactoring the backend when this plan was written (2026-10-24). Before step 1, compare the functions in "Interfaces used" below with `web/convex/` on `main` and fix this plan first if a name or shape changed.
- Every page reads `app/_demo/fixtures.ts` today. Only `PushSubscribeButton` on the dev page calls Convex. The integration points are tagged `TODO(release)` in `app/page.tsx`, `app/fridge/page.tsx`, `app/scan/page.tsx`, `app/stats/page.tsx`, `UseSoonList.tsx`, `ScanFlow.tsx`, and `fixtures.ts`.
- There is no sign-in screen. Every call runs as the demo user through the `ALLOW_DEMO_USER` fallback in `convex/model/auth.ts`, so `/api/dev/seed` must run before the pages work.
- The UI computes "days left" in the browser with `lib/freshness.ts` and `useNow`, so labels roll over at local midnight. The backend's `daysLeft` uses `profiles.utcOffsetMinutes` and is only recomputed when data changes (p1-03 Surprises), so the UI ignores it. The two agree when the browser's time zone matches the profile's offset; the demo user is seeded at UTC-7.
- Moving an item between fridge and freezer has a known food-safety bug (`docs/bugs.md`). This plan does not expose location editing until that bug is fixed.

## Scope

In scope: home, fridge, swipe cards, scan (upload, live parse status, review, confirm), manual add, stats, a root error boundary, and deleting the fixtures the pages no longer use.

Out of scope: sign-in and profile setup (including setting `utcOffsetMinutes`), a push opt-in outside the dev page, the in-app notification feed, the friends leaderboard (P2), fridge fullness and food groups (no backend), the streak counter (P2 gamification), and a "how much did you waste?" choice on the swipe card.

## Where code goes

Per `CLAUDE.md`, pages in `app/` call Convex hooks and pass data to components in `app/_components/`. Components keep their props narrow and do not call Convex themselves, except `SwipeTakeover`'s queue wrapper (step 4) and the scan flow (steps 6 to 8), whose job is the Convex round trip.

Components switch from `FridgeItem` in `lib/types.ts` to `ItemView`, imported as a type from `@/convex/items`. `lib/freshness.ts` already takes any `{ expiresAt?: number }`, so it does not change.

## Page behavior

### Home (`/`)

`items.useSoon({ days: USE_SOON_DAYS })` (3 days, from `lib/freshness.ts`), sorted and capped at 3 with `pickUseSoon` as today. Checking a task shows the check mark, then calls `items.resolve({ itemId, outcome: "used" })`. The live query drops the item. P1 has no undo (p1-03).

### Fridge (`/fridge`)

`items.list({ status: "active" })` plus `reviews.pending()`, merged and ordered with `sortByUrgency`. "Mark as used" calls `items.resolve` with `"used"`. A card shows "review expired item" only when the item's status is `expired`. An item whose date has passed but which the hourly cron has not expired yet shows the expired pill with "mark as used", because `items.extend` only accepts `expired` items.

A card for an undated item, or one with `checkLabel: true`, shows a date input labeled "No sourced shelf life. Set a date." or "Check the date on the package." Setting it calls `itemEdits.update({ itemId, expiresAt })`, which stores `expirySource: "user"`. Without this, undated items never expire and never get a swipe card (p1-03).

`FullnessPreview` keeps `demoFullness`.

### Swipe cards

This section moved here from p1-03 on 2026-10-24.

Frontend v3 (#9) redesigned this flow, and this plan wires v3's design to Convex. The takeover opens when the user taps "review expired item" on a fridge card, or taps a card tagged "check in". It does not open by itself.

Input. Every choice can be made three ways: drag past 40% of the card width, click the button, or press the arrow key. Left is the negative answer and right the positive one, on both cards. Escape or the "back" button closes card 1 and tags the item "check in" for this visit, or returns from card 2 to card 1.

Card 1, "did you use it?":

| Input | Result |
| --- | --- |
| Right: drag, "used →", ArrowRight | used |
| Left: drag, "← wasted", ArrowLeft, item has `canExtend: true` | card 2 for the same item |
| Left, item has `canExtend: false` | wasted |

Card 2, "does it look spoiled?", shows the item's `freshnessHint` with its source, or says there is no sourced hint yet.

| Input | Result |
| --- | --- |
| Left: drag, "← yes, toss :(", ArrowLeft | wasted |
| Right: drag, "no, 1-2 more days →", ArrowRight | extended |

Every result, and "mark as used" on a fridge card, waits 5 seconds behind an undo toast (`useDelayedCommit`) before the fridge page calls `items.resolve` or `items.extend`. Undoing a swipe reopens its card. Leaving the page saves the pending decision. During the wait, an extended item shows `extendsTo` from `reviews.pending`, the exact sourced date `items.extend` will set. The "extended" and "check in" tags last only for the visit, because the backend does not record them.

A "wasted" result without `fractionWasted` is stored as 0.5. If a mutation throws (for example, the item was already resolved elsewhere), the live query catches up.

### Scan (`/scan`)

The step order changes so a retake costs no model call:

1. Pick a photo or PDF (or receive one from the header camera button through `CAMERA_FILE_EVENT`).
2. Preview with "retake" and "continue".
3. "Continue" uploads: `receipts.generateUploadUrl`, a `POST` of the file to that URL, then `receipts.create({ fileId, fileType })`. The page puts the returned id in the URL as `?receipt=<id>` so a reload resumes instead of paying for a second parse.
4. `receipts.get({ receiptId })` drives the screen live. `uploaded` and `parsing` show "reading your receipt...". `failed` shows `receipt.error` and a retake button. `parsed` shows the check list.
5. The check list has one row per draft: the name, a date input filled from `expiresAt` (empty with "not sourced" when there is none, highlighted when `checkLabel` is true), and a remove button. A changed name or date calls `itemEdits.update` right away. Removed rows are collected and sent as `removeItemIds`.
6. The "unknown food tip" card shows the first draft with `showTip: true` and a `storageTip`, with its `SourceNote`. Dismissing it calls `foods.ackTip({ foodId })`.
7. "Add to fridge" calls `receipts.confirmDrafts({ receiptId, removeItemIds })` and goes to `/fridge`.

Images over 3.75 MB are scaled down in the browser before upload (canvas, JPEG, longest edge 2000 px), because `receiptsNode.parse` rejects larger images and phone photos often exceed that. PDFs over 20 MB are rejected with a message before upload.

Manual add is a third choice on step 1, "type it instead": a name field and an optional date. It calls `receiptsNode.addManual({ name, expiresAt? })` with `useAction` and goes to `/fridge`. The design has no screen for this yet, so it reuses the existing form classes.

### Stats (`/stats`)

The page becomes a client component. The circles read `stats.summary({ range: "month" })`, matching the "this month" tooltip: "items rescued" is `itemsUsed` and "lbs wasted" is `wastedLbs` rounded to one decimal. When `itemsMissingWeight` is above 0 the tooltip says the number is a floor. The third circle, a streak in v3, shows `usedRate` as "% used" until P2 adds streaks. v3's count-up animation and random mascot pose are kept.

The table shows three rows from three `stats.summary` calls, "this week", "this month", and "all time", instead of four calendar weeks. The backend has no per-week history, and a rolling range needs no new query.

### Friends (`/friends`)

No change. It stays on `demoLeaderboard` with its existing `TODO(release)`.

## Progress

- [x] 1. Backend additions and shared plumbing (2026-10-24: no page calls Convex yet, so the error page was checked with a throwaway page that called `items.list` before seeding)
- [x] 2. Home use-soon list (2026-10-24: verified on a fresh seed; checking saves after 900 ms, see Decision log)
- [x] 3. Fridge list and setting dates (2026-10-24: `endOfLocalDay` and `dateInputValue` in `lib/freshness.ts` turn a picked date into the end of that local day)
- [x] 4. Swipe card queue with the second card (2026-10-24: built as `SwipeQueue`, then replaced by v3's tap-to-review flow in the rebase; see Decision log)
- [x] 5. Stats page (2026-10-24: matches `/api/stats/summary` for all three ranges after the step 4 swipes)
- [x] 6. Scan upload and live parse status (2026-10-24: a 61 MB generated PNG uploaded as a 1.85 MB JPEG; with no API key the receipt failed and showed the key message with a retake button)
- [x] 7. Scan check list, tips, and confirm (2026-10-24: mock `costco_test_2` through `receipts.devCreateParsed`; 6 of 7 lines confirmed, the typed Red Bull date stored as `user`)
- [x] 8. Manual add (2026-10-24: "spinach" got a FoodKeeper date without a model call, a typed date on "eggs" was stored as `user`, and "dragon fruit" without a key showed the key error inline)
- [x] 9. Delete unused fixtures and validate (2026-10-24: see Validation)

## Steps

1. In `convex/items.ts`, add `checkLabel: needsLabelDate(food, item.expirySource)` to `ItemView` in `toItemViews`, as p1-02 asked. In `convex/receipts.ts`, build `receipts.get`'s `drafts` with `toItemViews`, so drafts carry `storageTip`, `showTip`, and `checkLabel` like every other item. Add `app/error.tsx` that shows the error message, so "Demo user not seeded. Open /api/dev/seed first." reaches the screen instead of a blank page. Pages show their existing `aria-busy` shell while a `useQuery` returns `undefined`.
   Verify: lint, typecheck, and `npm test` pass. `/api/receipts/get?id=<id from /api/dev/parse-test?name=costco_test_2.jpeg&mock=1>` shows `showTip` and `checkLabel` on each draft. With an empty database, `/` shows the seed message.

2. Wire `app/page.tsx` and `UseSoonList` as described under Home. Remove the two `TODO(release)` tags they carry.
   Verify: after `/api/dev/seed`, home lists the chicken breast (1 day) and cremini mushrooms (3 days). Checking the chicken removes it, and `/api/stats/summary?range=week` shows one more used item.

3. Wire `app/fridge/page.tsx`, `FoodList`, and `FoodCard` as described under Fridge.
   Verify: after a fresh seed, the fridge shows every active and expired seed item, with the 3 expired ones offering "review expired item". Setting a date on the undated milk gives it that date, and `/api/items/get?id=<milk>` shows `expirySource: "user"`.

4. Rework `SwipeTakeover` and add its queue wrapper as described under Swipe cards. Mount the wrapper on `/` and `/fridge`.
   Verify: after a fresh seed the takeover opens with 3 cards. "Not used" on the spinach (`canExtend: true`) shows card 2 with its freshness hint, and "1-2 more days" moves it to the home list with 2 days left. "Not used" on the ground beef (`canExtend: false`) resolves it at once, and `/api/stats/summary` counts half of its 1099 cents. Arrow keys answer both cards, and holding one answers only one card.

5. Wire `app/stats/page.tsx` and `WasteStats` as described under Stats.
   Verify: after a fresh seed, the circles and the "this month" row match `/api/stats/summary?range=month`, and the other rows match `range=week` and `range=all`.

6. Wire steps 1 to 4 of the scan flow, including the image downscale and the `?receipt=` parameter. Delete `DEMO_READING_MS`.
   Verify: with `ANTHROPIC_API_KEY` set on the deployment, uploading `costco_test_2.jpeg` from `web/data/` shows "reading your receipt..." and then 7 rows. A phone photo over 3.75 MB parses instead of failing. Uploading `docs/food_storage_chart.pdf` shows "This file doesn't look like a grocery receipt." and a retake button.

7. Wire steps 5 to 7 of the scan flow. Delete `ParsedReceiptLine` and `demoParsedReceipt`.
   Verify: without an API key, open `/api/dev/parse-test?name=costco_test_2.jpeg&mock=1`, then `/scan?receipt=<receiptId>`. The 7 rows appear with ground beef dated and the packaged items highlighted. Remove one row, set a date on another, and confirm. The fridge then shows 6 new items, one with the typed date. Dismissing the tip card three times for the same food stops it from appearing.

8. Add manual entry as described under Scan.
   Verify: "spinach" adds an item with a FoodKeeper date and no model call. "dragon fruit" with an API key matches `pitaya/dragon fruit`. A typed date wins over the sourced one.

9. Trim `app/_demo/fixtures.ts` to `demoFullness` and `demoLeaderboard`, and remove `FridgeItem` from `lib/types.ts` if nothing uses it.
   Verify: `grep -r "TODO(release)" app` lists only the friends page, `Leaderboard`, `demoFullness`, the dev push page, and the parse-test mock route. Lint, typecheck, and `npm test` pass, and the Validation click-through passes.

## Interfaces used

| Page or component | Convex function | Kind |
| --- | --- | --- |
| Home | `items.useSoon({ days })`, `items.resolve` | query, mutation |
| Fridge | `items.list({ status })`, `reviews.pending()`, `items.resolve`, `itemEdits.update({ itemId, expiresAt })` | query, mutation |
| Swipe queue | `reviews.pending()`, `items.resolve`, `items.extend` | query, mutation |
| Scan | `receipts.generateUploadUrl`, `receipts.create`, `receipts.get`, `itemEdits.update`, `foods.ackTip`, `receipts.confirmDrafts` | mutation, query |
| Manual add | `receiptsNode.addManual` | action |
| Stats | `stats.summary({ range })` | query |

## Validation

- `npm run lint`, `npm run typecheck`, and `npm test` pass.
- No page imports `app/_demo/fixtures.ts` except the fridge page (for `demoFullness`) and the friends page.
- Click-through from a fresh `/api/dev/seed`, in the running app at phone width and desktop width: swipe all 3 cards, check one item off the home list, set a date on the milk, scan `costco_test_2.jpeg` (live or through the mock route), remove one line, confirm, and add "spinach" by hand. The stats page changes after each resolve without a reload.
- Every date on screen comes from `expirySource` `fda_chart`, `foodkeeper`, or `user`. Items with no date say so.

Result on 2026-10-24, against a local deployment (`localhost:3270`) with no `ANTHROPIC_API_KEY`: lint, typecheck, 49 tests, and `next build` pass. `grep -r "TODO(release)" app` lists only the friends page, `Leaderboard`, `app/_demo/fixtures.ts` (for `demoFullness` and `demoLeaderboard`), the dev push page, and the parse-test mock route. From a fresh seed: the takeover opened with 3 cards (beef wasted, spinach extended to 2 days, strawberries used), two home tasks were checked off, the milk got a typed date, the mock `costco_test_2` receipt was reviewed and confirmed with one line removed, and "spinach" and "eggs" were added by hand. The stats page matched `/api/stats/summary` for all three ranges. Home, fridge, swipe cards, scan, and stats fit 375 px with no horizontal scroll. After the v3 rebase the same click-through passed on the merged code, with the swipe flow driven through v3's cards: back, check in, undo, and a 5-second commit. Not covered: anything a real phone camera does differently from the test images.

Live check on 2026-10-24 against Leo's dev deployment (`dev:secret-opossum-432`), with this branch's functions pushed and main's restored afterwards: `costco_test_2.jpeg`, loaded into the page as a `File` and sent through the scan flow, parsed to 7 lines with the store (Costco Wholesale), the 2026-10-06 date, prices, and sourced dates. It was confirmed with one duplicate line removed. `tj_test_1.pdf` parsed to 7 Trader Joe's lines. Manual add of "dragon fruit" went through the model and matched a FoodKeeper food (14 days, FoodKeeper tip).

## Decision log

- 2026-10-24: The swipe card spec moved from p1-03 into this plan, so the frontend work has one home. p1-03 keeps a pointer.
- 2026-10-24: The scan flow uploads on "continue" instead of on pick, so a retake does not spend a model call.
- 2026-10-24: The scan check list edits dates instead of "good for N days". The backend stores `expiresAt`, and the printed-date flow (`checkLabel`) asks for the date on the package.
- 2026-10-24: The stats table shows this week, this month, and all time instead of four calendar weeks, so no new query is needed. A per-week query can come with P2's `userStats` table.
- 2026-10-24: The UI computes days left in the browser and ignores the backend's `daysLeft`, so labels roll over at local midnight without a data change.
- 2026-10-24: The third stats circle shows `usedRate` ("% used") instead of being hidden. Hiding it left the 3-column circle grid off-center at every breakpoint, and the used rate is real data.
- 2026-10-24: Rebased onto frontend v3 (#9). v3's swipe cards, undo toast, and "check in" tags replace this plan's auto-opening `SwipeQueue`, which was deleted. v3 already had the second card, so its `SwipeTakeover` is kept with one change: `freshnessHint` may be `null`, as the backend returns it.
- 2026-10-24: `reviews.pending` returns `extendsTo`, the date `items.extend` would set. v3 previewed an extension as now plus 2 days, which can pass the sourced range's high end and would show an unsourced date during the undo window.
- 2026-10-24: A checked use-soon task waits 900 ms before calling `items.resolve`, so the check mark shows and a misclick can be unchecked before it is saved. Leaving the page during the wait saves the check instead of dropping it.
- 2026-10-24: Home has two per-user settings stored on `profiles`. The wasted-% slider sets the `fractionWasted` that `items.resolve` stores for later tosses (default 50%). "Always ask 'does it look spoiled?'" shows card 2 even when `canExtend` is false; that card offers only "toss" and says the source gives no more days. It is off by default and makes the card easier to demo. Desktop fridge rows now collapse when the mouse leaves them.
- 2026-10-24: A packaged food with no matching illustration shows `public/illustrations/food/box.png`. That box is a placeholder drawn for the demo; the designer is making the catch-all icon that replaces it (tagged `TODO(release)` in `FoodArt.tsx`).

## Open questions

1. Expired items only prompt when the user opens the fridge (v3's flow). Decide whether home should also surface them, for example as a line linking to the fridge.
2. Does the designer want a screen for manual add, the push opt-in, and the notification feed? This plan builds only manual add, with existing styles.
3. The streak circle shows the used rate from `stats.summary` until P2 (see Decision log). Confirm with the designer, or pick something else.
4. Sign-in and setting `utcOffsetMinutes` have no plan. Real users need both before launch.

## Surprises

- 2026-10-24: On a fresh local deployment, `/api/dev/seed` loads the reference foods without the tips, hints, and `hasPrintedDate` flags that `foods.backfillTips` writes. On the mock `costco_test_2` receipt only the energy drink (a new food from the fixture) gets `checkLabel: true`, and the rolls, buns, and seasoning have no storage tip. Run `npx convex run foods:backfillTips` (needs `ANTHROPIC_API_KEY`) before checking the highlighted rows in step 7. The team's cloud dev deployment has already been backfilled.
- 2026-10-24: Card 2's question wrapped to three lines at 44 px on a 375 px screen and pushed the card past the top of the viewport. The fix (`.swipe-card--question`) was dropped in the v3 rebase, since v3 has its own card 2 layout.
- 2026-10-24: Leo's dev deployment has not run `foods:backfillTips`. Every food there has `freshnessHint: null` and no `hasPrintedDate`, so the live check showed no package-date highlights and card 2 has no hint to show. Run `npx convex run foods:backfillTips` against it (it makes model calls) before demoing those parts.
- 2026-10-24: The main checkout's `node_modules` predates `@anthropic-ai/sdk`, so `npx convex dev --once` there fails to bundle. Main's functions were restored from this worktree instead (see `CLAUDE.md`).
- 2026-10-24: While the browser pane is hidden, it runs no animation frames. CSS transitions and v3's stats count-up stall at their start values (cards read as collapsed, circles as 0) until a screenshot forces a frame. Check computed target values or take a screenshot before calling a layout broken.
- 2026-10-24: Running `next build` while `next dev` was up left Turbopack's watcher stuck, and later CSS edits never reached the browser. Restarting the dev server fixed it.
- 2026-10-24: In the browser pane, a script calling `input.blur()` did not fire React's `onBlur` because the pane did not have focus. Real clicks did. Test the scan check list's save-on-blur with clicks, not scripted focus.
- 2026-10-24: The `frontend-dev` launch config runs `next dev web` from the repo root, so `process.cwd()` is the root and `/api/dev/parse-test` looks for `data/` and `convex/data/` there. Run Next from `web/` to use the mock receipt route.
