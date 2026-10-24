# P1-03: Expiry lifecycle, reminders, and waste stats

Tier: P1. Estimate: 5 to 6 hours for one engineer. Depends on p1-01. Can run in parallel with p1-02.

## Purpose

Once items are in the fridge, the backend tracks them to the end. Users see a use-soon list sorted by expiry, get at most one reminder a day, and get a swipe card for each item that expires. The swipe ("used" or "not used") is the waste measurement, and the stats queries turn those outcomes into dollars and pounds wasted. When the user swipes "not used", a second card shows the food's freshness hint and lets them toss it or keep it 1 to 2 more days.

This covers "Food reminder system" and "Food waste measurement" in `docs/PRODUCT.md`.

## Context

- Schema, `getUserId`, the `/api` route convention, vitest, and the demo seed are in p1-01. Read that first.
- The product spec already decides the reminder cadence. Ping about 1 week, 3 days, and 1 day before expiry, use push for time-sensitive reminders, show a swipe card only on expiry, and use a to-do-style list before expiry so users are not flooded with prompts.
- To keep reminders from feeling like spam, this plan sends one digest per user per day covering every item at the 7, 3, or 1 day mark, instead of one push per item.
- Design v2 adds a second swipe card. p1-02's `expiryFor` sets `expiresAt` from the low end of the sourced range, so food is often still good when its card appears. After "not used", the card asks "does your food look spoiled?" with "yes, toss :(" and "no, 1-2 more days to eat it!" and shows the food's `freshnessHint`. The extension is capped at the high end of the sourced range, so every date the app shows still comes from the FDA chart, FoodKeeper, or the user, per `CLAUDE.md`.
- The first swipe card is binary in the spec. The backend also accepts an optional `fractionWasted` (0 to 1) so a "half used" option can be added to the UI later without a schema change.
- Items with no `expiresAt` (no sourced shelf life, see p1-02) never expire automatically and are left out of reminders. The digest counts them so the user is nudged to set a date.

## Behavior

Hourly cron `lifecycle.tick` (runs at minute 0, UTC):

1. Expire. Use the `by_status_expires` index to find `active` items with `expiresAt <= now` and set them to `expired`. These are the swipe cards. Convex sorts a missing field before every number, so the range needs a lower bound (`.gte("expiresAt", 0)`) or undated items come back too.
2. Digest. Find `active` items with `expiresAt` within the next 8 days, grouped by user. For each user whose local hour (from `profiles.utcOffsetMinutes`) equals `digestHour`, and who has no `digest` notification for today's local `dateKey`, call `buildDigest`. If it returns a digest, insert a `notifications` row and schedule `push.send`.

`buildDigest(items, pendingReviews, undatedCount, now, utcOffsetMinutes)` in `lib/digest.ts` is pure:

- collects items whose days left, counted in local calendar days, is exactly 7, 3, or 1
- adds the count of `expired` items waiting for a swipe
- adds the count of undated items, at most once a week
- returns `null` if all three are empty

Example digest: title "3 things to use soon", body "Spinach and ground beef expire tomorrow. Eggs have 3 days left. 2 items need a swipe."

Resolving an item (`items.resolve`):

- `outcome: "used"` sets status `used` and `fractionWasted` to 0 unless given.
- `outcome: "wasted"` sets status `wasted` and `fractionWasted` to 1 unless given.
- Works on `active` items (marked from the use-soon list before expiry) and `expired` items (the swipe card). Sets `resolvedAt`.

Extending an item (`items.extend`, the "no, 1-2 more days" answer on the second card):

- `extendExpiry({ purchasedAt, range, now })` in `lib/extension.ts` is pure. It returns `min(now + 2 days, purchasedAt + range.max days)`, or `null` when that is not later than `now`.
- `range` is the food's range for the item's location, falling back to its fridge range, the same rule as p1-02's `expiryFor`. Items with `expirySource: "user"` or no `foodId` have no sourced high end and cannot be extended.
- `items.extend({ itemId })` works on `expired` items only. It sets the new `expiresAt` and moves the item back to `active`, so it gets another swipe card when the extension runs out. It throws when `extendExpiry` returns `null`.
- Example: ground beef has an FDA fridge range of 1 to 2 days. Bought on day 0, it expires on day 1. Extending on day 1 moves it to day 2. On day 2 the range is used up, so the second card offers only "toss".

Stats: `summarizeWaste(items, range, now)` in `lib/wasteStats.ts` is pure, and `stats.summary({ range })` loads the user's resolved items and calls it. Range is `week`, `month`, or `all`.

- `itemsUsed`, `itemsWasted`, `usedRate`
- `wastedCents` = sum of `priceCents * fractionWasted`
- `wastedGrams` = sum of `weightGrams * fractionWasted`, and `wastedLbs` = `wastedGrams / 453.6`
- items with no price or weight count toward item totals and are skipped in the money and weight sums; return `itemsMissingPrice` so the UI can say "about"

Computing on read is fine at hackathon scale. P2's leaderboard will need these numbers per user per week and adds a denormalized `userStats` table then.

## Progress

- [x] 1. Item list queries (2026-10-23: `items.list`, `items.get`, `items.useSoon`, `reviews.pending`; `showTip` implemented in full)
- [x] 2. `items.resolve`
- [x] 3. `lib/digest.ts` and its tests
- [x] 4. `lifecycle.tick` and the cron
- [x] 5. Web push sending (2026-10-23: verified up to the `web-push` call; a real system notification needs a human, see Surprises)
- [x] 6. In-app notification feed
- [x] 7. `lib/wasteStats.ts`, its tests, and `stats.summary`
- [x] 8. `/api` test routes
- [ ] 9. `lib/extension.ts`, its tests, and `items.extend`

## File ownership while p1-02 runs in parallel

This plan owns `convex/items.ts` (`list`, `get`, `useSoon`, `resolve`, and the item shape), `convex/reviews.ts`, `convex/lifecycle.ts`, `convex/crons.ts`, `convex/push.ts`, `convex/pushNode.ts`, `convex/notifications.ts`, `convex/stats.ts`, `runTick` and `pushTest` in `convex/dev.ts`, `lib/digest.ts`, `lib/wasteStats.ts`, `lib/pushDelivery.ts`, their tests, the routes under `app/api/items/`, `app/api/reviews/`, `app/api/stats/`, `app/api/notifications/`, `app/api/dev/tick/` and `app/api/dev/push-test/`, `app/dev/push/page.tsx`, `app/_components/PushSubscribeButton.tsx`, and `public/sw.js`. p1-02 owns `convex/receipts.ts`, `convex/receiptsNode.ts`, `convex/itemEdits.ts` (its `confirmDrafts`, `update`, `addManual`), `convex/foods.ts` (including `foods.ackTip`), and `lib/expiry.ts`. Neither plan edits `convex/schema.ts` or `convex/seed.ts`. Both regenerate the tracked `convex/_generated/api.d.ts`; on a merge conflict there, run `npx convex codegen` instead of hand-merging.

## Steps

1. In `convex/items.ts`, add `list({ status? })` (defaults to `active`, sorted by `expiresAt` with undated items last) and `useSoon({ days = 7 })` (active items expiring within `days`). Each item includes `daysLeft`, `storageTip`, `freshnessHint`, and `showTip` (the familiarity rule from p1-02; return `showTip: false` until p1-02 lands). Add `reviews.pending()` returning `expired` items, oldest first, each with its `freshnessHint` and a `canExtend` flag (whether `extendExpiry` returns a date), so the UI knows whether the second card offers "1-2 more days".
   Verify: after `/api/dev/seed`, `useSoon` returns the 1, 3, and 7 day items in that order and `reviews.pending` returns 3 items.

2. Add `items.resolve({ itemId, outcome, fractionWasted? })` with the rules above. Reject items that are already `used` or `wasted`, and reject `fractionWasted` outside 0 to 1.
   Verify: resolving an expired item as `wasted` removes it from `reviews.pending`.

3. Write `lib/digest.ts` and `lib/digest.test.ts`. Cover: items at exactly 7, 3, and 1 days are included and items at 2, 4, 5, and 6 are not; an item bought with 3 days of shelf life gets the 3 and 1 day reminders and never a 7 day one; a user at UTC-7 with `digestHour` 9 is due at 16:00 UTC; nothing to report returns `null`.
   Verify: `npm test` passes.

4. Write the internal mutation `lifecycle.tick({ now?, force? })` and register it in `convex/crons.ts` with `crons.hourly`. `now` and `force` exist for testing; `force` skips the `digestHour` check and the daily dedupe. Dedupe with the `by_user_date` index on `notifications`, so running tick twice in the same hour sends one digest.
   Verify: two back-to-back runs with the same `now` create one notification, and an undated seed item stays `active`.

5. Generate VAPID keys with `npx web-push generate-vapid-keys`. Store `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (a `mailto:` address) with `npx convex env set`, and put only the public key in `.env.local` as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. The private key never goes in a `NEXT_PUBLIC_` var. Add `push.saveSubscription` and `push.removeSubscription` mutations. Write `convex/pushNode.ts` with `"use node"` and the internal action `send({ notificationId })` using the `web-push` package. Delete a subscription when the push service answers 404 or 410.
   To test before the real UI exists, add a dev-only page at `app/dev/push/page.tsx` with one Subscribe button, tagged `// TODO(release): replace with designed opt-in`, plus `public/sw.js` that shows the notification.
   Verify: subscribe on the dev page, open `/api/dev/push-test`, and a system notification appears.

6. Add `notifications.list()` (newest first, last 30 days) and `notifications.markRead({ notificationId })`. This feed is the fallback where push is unavailable, which includes iPhones that have not added the site to the home screen.
   Verify: after a tick, the digest appears in `/api/notifications/list`.

7. Write `lib/wasteStats.ts` and `lib/wasteStats.test.ts` covering range filtering, partial `fractionWasted`, and items missing price or weight. Then add `stats.summary({ range })`.
   Verify: `npm test` passes, and after `/api/dev/seed`, `/api/stats/summary?range=week` matches a hand count of the seeded items.

8. Add `/api` routes following p1-01:
   - `GET /api/items/list?status=active`
   - `GET /api/items/use-soon?days=7`
   - `GET /api/reviews/pending`
   - `GET /api/items/resolve?id=<itemId>&outcome=used` (dev-only GET)
   - `GET /api/stats/summary?range=week`
   - `GET /api/notifications/list`
   - `GET /api/dev/tick?now=2026-10-24T16:00:00Z&force=1` runs `lifecycle.tick` through a public `dev.runTick` mutation that throws unless `ALLOW_DEMO_USER` is `"true"`, tagged `// TODO(release): remove dev.runTick`.
   - `GET /api/dev/push-test` sends a test push to the demo user's subscriptions.
   Verify: from a fresh seed, swipe all three review items through `/api/items/resolve` and watch `/api/stats/summary` change.

9. Write `lib/extension.ts` and `lib/extension.test.ts`. Cover: the 2-day extension when the range allows it; the cap at `purchasedAt + range.max` (the ground beef example); `null` once the range is used up; `null` when the card is swiped late and `purchasedAt + range.max` has already passed. Then add `items.extend({ itemId })` with the rules above and a dev-only `GET /api/items/extend?id=<itemId>`.
   Verify: `npm test` passes. After `/api/dev/seed`, `reviews.pending` shows `canExtend: true` for the baby spinach (FoodKeeper 3 to 7 days, expired 1 day ago) and `false` for the ground beef (expired 2 days ago, past its 2-day high end). Extending the spinach moves it from `reviews.pending` to `useSoon` with 2 days left.

Frontend note: `app/_components/SwipeTakeover.tsx` has only the first card today. "Wasted" on that card should open the second card when `canExtend` is true, and resolve as wasted when it is false.

## Interfaces delivered

| Convex function | Kind | Test route |
| --- | --- | --- |
| `items.list({ status? })` | query | `GET /api/items/list?status=active` |
| `items.get({ itemId })` | query | `GET /api/items/get?id=` |
| `items.useSoon({ days? })` | query | `GET /api/items/use-soon?days=7` |
| `reviews.pending()` | query | `GET /api/reviews/pending` |
| `items.resolve({ itemId, outcome, fractionWasted? })` | mutation | `GET /api/items/resolve?id=&outcome=used` |
| `items.extend` | mutation | `GET /api/items/extend` |
| `stats.summary({ range? })` | query | `GET /api/stats/summary?range=week` |
| `notifications.list()` | query | `GET /api/notifications/list` |
| `notifications.markRead({ notificationId })` | mutation | `GET /api/notifications/mark-read?id=` |
| `push.saveSubscription({ endpoint, p256dh, auth })`, `push.removeSubscription({ endpoint })` | mutation | `/dev/push` page |
| `lifecycle.tick({ now?, force? })` (via `dev.runTick`) | internal mutation, hourly cron | `GET /api/dev/tick?now=&force=1` |
| `pushNode.send({ notificationId })`, `pushNode.sendTest({ userId })` (via `dev.pushTest`) | internal action | `GET /api/dev/push-test` |

Return shapes for the frontend:

- `items.list`, `items.useSoon`, and `reviews.pending` return `ItemView[]`; `items.get` returns `ItemView | null` (null when missing or not the caller's). `ItemView` is the `items` document plus `daysLeft: number | null` (local calendar days: 0 is today, negative is past, null when undated), `storageTip: { text, source: "fda_chart" | "foodkeeper" | "llm" } | null`, `freshnessHint: { text, source: "foodkeeper" | "llm" } | null`, and `showTip: boolean`. `list` sorts by `expiresAt` with undated items last, `useSoon` returns active dated items with `daysLeft <= days` soonest first, and `pending` returns `expired` items oldest expiry first.
- `items.resolve` returns `{ itemId, status, fractionWasted, resolvedAt }`. It throws on items that are not `active` or `expired`, and on a `fractionWasted` outside 0 to 1.
- `stats.summary` returns `{ range, itemsUsed, itemsWasted, usedRate: number | null, wastedCents, wastedGrams, wastedLbs, itemsMissingPrice, itemsMissingWeight }`. `range` defaults to `week`.
- `notifications.list` returns `notifications` documents (`{ _id, dateKey, kind: "digest", title, body, itemIds, undatedCount?, readAt? }`), newest first, from the last 30 days.
- `dev.runTick` returns `{ expired: number, digests: Id<"notifications">[] }`. `dev.pushTest` returns `{ subscriptions, payload: { title, body, url }, sent, gone: string[], failed: string[] }`.

## Validation

- `npm run lint`, `npm run typecheck`, and `npm test` pass.
- With the cron running, an item seeded to expire in the past becomes a swipe card within an hour without anyone calling an endpoint.
- An item with no `expiresAt` never becomes a swipe card.
- No extended item has an `expiresAt` later than `purchasedAt` plus the high end of its sourced range.
- A user with 5 items hitting reminder days on the same day gets one push, not five.
- On a browser that granted notification permission, `/api/dev/tick?force=1` produces a system notification.

Result on 2026-10-23, on a fresh seed against `localhost:3005`: lint, typecheck, and 24 tests pass. `/api/items/use-soon` returns Chicken breast (1), Cremini mushrooms (3), Eggs (7) in that order. `/api/reviews/pending` returns 3. `/api/stats/summary?range=week` returned 1 used, 3 wasted, 878 cents, 1304 g, 2.87 lb, which matches a hand count of the seed (yogurt half of 599, cottage cheese 429, a quarter of the 599 bread). Resolving the three review items (beef wasted, spinach used, strawberries half wasted) moved it to 2 used, 5 wasted, 2227 cents. `/api/dev/tick?now=2026-10-24T16:00:00Z&force=1` made one notification and a second run without `force` made none. A tick at now + 400 days expired every dated item and left the undated milk `active`. The cron check and the system notification are below.

## Decision log

- 2026-10-23: One daily digest per user instead of per-item pushes, to keep reminders from feeling like spam.
- 2026-10-23: Hourly cron that scans by index, instead of scheduling a job per item with `ctx.scheduler.runAt`. Edits to `expiresAt` and early resolution need no job cancellation, and a missed run catches up on the next hour.
- 2026-10-23: Store `utcOffsetMinutes` rather than an IANA time zone. Daylight saving shifts the digest by an hour until the client reports the new offset on next sign-in, which is acceptable for P1.
- 2026-10-23: Keep an optional `fractionWasted` on the backend even though the P1 swipe is binary.
- 2026-10-23: Digest and stats math live in `lib/` as pure functions so they can be unit tested, per `CLAUDE.md`.
- 2026-10-24: Design v2's "extend by 2 days" is capped at the high end of the sourced range. A flat 2 days would be an unsourced shelf-life number, which `CLAUDE.md` forbids. The cap is computed from the food row at swipe time, so the schema does not change.

- 2026-10-23: `daysLeft` counts local calendar days from the user's `profiles.utcOffsetMinutes`, so "tomorrow" means the next local date and not the next 24 hours. The item queries compute it with `Date.now()`, and Convex reruns a query only when its data changes, so an open page can show yesterday's `daysLeft` after midnight until something refreshes it. The frontend can recompute from `expiresAt` if that matters.
- 2026-10-23: `showTip` is true while `foodFamiliarity.tipViews` is below 3 and the food has a `storageTip` or `freshnessHint`. Items with no `foodId`, or whose food has neither, return `false`, since there is nothing to show.
- 2026-10-23: `lifecycle.tick` loops over `profiles` instead of grouping the next 8 days of items by user. The item scan would skip users whose only news is a pending swipe or an undated item. Tagged `TODO(release)` to scan only the profiles due this hour once there are many users.
- 2026-10-23: `buildDigest` takes a sixth argument, `lastUndatedNudgeDateKey`, so the once-a-week rule for undated items lives in `lib/` with a test. `tick` reads it from the user's recent notifications.
- 2026-10-23: The digest body reads "Expiring tomorrow: Spinach and Ground beef. In 3 days: Eggs. 2 items need a swipe." instead of "Spinach and ground beef expire tomorrow", because an item name does not say whether to use "has" or "have". `itemIds` lists only the 1, 3, and 7 day items.
- 2026-10-23: `summarizeWaste` returns `usedRate: null` when nothing was resolved in range. `itemsMissingPrice` counts only items with some waste and no price, which are the ones that make `wastedCents` an underestimate. `itemsMissingWeight` does the same for weight.
- 2026-10-23: The push send loop lives in `lib/pushDelivery.ts` with the sender injected, so the rule that 404 and 410 delete a subscription is unit tested without Convex or a push service.
- 2026-10-23: `dev.pushTest` is a public action rather than a mutation, so `/api/dev/push-test` can return the delivery result. Added `GET /api/items/get` and `GET /api/notifications/mark-read`, which the step 8 list did not have.
- 2026-10-23: `VAPID_SUBJECT` is `mailto:dev@freshly.test`. Push services see this address on every push, so a real team address should replace it before launch.

## Surprises

- 2026-10-23: Two other sessions had local Convex backends on ports 3210 and 3230. `npx convex dev --local-cloud-port 3250 --local-site-port 3251` runs this worktree's backend beside them. The state lives in the worktree's own `.convex/local/default`, so no data is shared. Next.js ran on 3005.
- 2026-10-23: The Convex Auth env vars were generated with a short `jose` script (an RS256 key and its JWKS, as `npx @convex-dev/auth` makes them) and piped into `npx convex env set`, because the CLI also tries to edit tracked files.
- 2026-10-23: The browser pane denies notification permission, so no real system notification was seen. Verified instead: `push.saveSubscription` stores a subscription (made with a generated P-256 key), `/api/dev/push-test` builds the payload `{ title, body, url }`, `web-push` encrypts and sends it, and a network failure is reported as `failed` without deleting the row. A forced tick schedules `pushNode.send`, which completed successfully. `web-push` only speaks HTTPS, so the 404 and 410 path was checked by unit test (`lib/pushDelivery.test.ts`) plus a direct run of `push.deleteByEndpoints`. To check in a real browser: run the app, open `http://localhost:3005/dev/push`, click Subscribe and allow notifications, then open `http://localhost:3005/api/dev/push-test`. The JSON should say `"sent": 1` and a system notification should appear. `/api/dev/tick?force=1` should then show the digest as a notification.
- 2026-10-23: Seeded `expiresAt` values are relative to the moment of seeding, while `/api/dev/tick?now=...` uses the given time. A tick at a fixed `now` far from the seed time sees different `daysLeft` values than the seed intends, so the 1, 3, and 7 day items may not appear in that digest. `/api/dev/tick?force=1` without `now` uses the real time and shows them.
- 2026-10-23: A forced tick with a future `now` writes a notification with a future `dateKey`. Later real-time ticks ignore it for the weekly undated check, which only looks at dates up to today. This only happens in dev, and `/api/dev/seed` clears it.

