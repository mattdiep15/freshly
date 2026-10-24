# P2-02: Grocery list

Tier: P2. Estimate: 2 to 3 hours for one engineer, plus wiring the designer's screen when it lands. Depends on p2-01. Can run in parallel with p2-03 and p2-04.

## Purpose

Users write down what to buy next, check items off by hand, and see them check off on their own when a scanned receipt or a manual add includes them. This covers "Grocery list for what to buy next" in `docs/PRODUCT.md`.

Personalized hints ("last time you threw out half your spinach") are not in this plan. They moved to `p3-integrations.md` on 2026-10-24 so the list ships first.

## Context

- Code paths are relative to `web/`. `getUserId`, the `/api` route convention, and the demo seed are in p1-01.
- The `groceryItems` table is in p2-01. An entry is unchecked while `checkedAt` is absent.
- Items become `active` in two places: `receipts.confirmDrafts` (a confirmed scan) and `itemEdits.insertManual` (manual add). Both need to check off matching list entries.
- v5 added `foods.catalog` for name suggestions in the manual add form. The grocery list's add box can use the same suggestions and pass the chosen `foodId`.
- The designer is drawing the grocery list screen. Where it sits in the nav (its own tab, or a section of the fridge tab) is their call. The backend does not depend on it.

## Behavior

Matching, in `lib/grocery.ts`: `entriesToCheckOff(entries, items)` is pure. For each unchecked entry it returns the entry's id when any new item matches it:

- both have a `foodId` and the ids are equal, or
- either has no `foodId` and their names match after lowercasing and trimming.

One item checks off every entry it matches, so "spinach" listed twice clears both.

Functions in `convex/grocery.ts`:

- `grocery.list()` returns unchecked entries oldest first, then entries checked in the last 7 days, newest check first. Older checked entries are hidden.
- `grocery.add({ name, foodId? })` trims the name and rejects an empty one. Without a `foodId`, it looks up `foods` by `by_name` on the lowercased name and stores the match, if any.
- `grocery.toggle({ entryId })` sets or clears `checkedAt`, with `checkedBy: "user"`.
- `grocery.remove({ entryId })` deletes the entry.
- `checkOffGroceries(ctx, userId, items)` in `convex/model/grocery.ts` loads the user's unchecked entries, calls `entriesToCheckOff`, and patches the matches with `checkedBy: "receipt"`. Manual adds also use `"receipt"`, since both mean "bought it".

Every public function checks that the entry belongs to the caller.

## Steps

1. Write `lib/grocery.ts` and `lib/grocery.test.ts`. Cover: a `foodId` match; a name match when the entry has no `foodId`; no match when both have different `foodId`s even if the names look alike; checked entries are never returned; one item clears two entries with the same food.
   Verify: `npm test` passes.

2. Write `convex/grocery.ts` with `list`, `add`, `toggle`, and `remove`.
   Verify: through the routes in step 4, add "Spinach" and "oat milk", toggle one, and `list` shows the unchecked one first.

3. Write `checkOffGroceries` and call it at the end of `receipts.confirmDrafts` (with the confirmed items) and `itemEdits.insertManual` (with the new item).
   Verify: with "spinach" on the list, manually add "baby spinach" that resolves to the same food, and the entry shows `checkedBy: "receipt"`.

4. Add `/api` routes following p1-01:
   - `GET /api/grocery/list`
   - `GET /api/grocery/add?name=spinach` (dev-only GET)
   - `GET /api/grocery/toggle?id=<entryId>` (dev-only GET)
   - `GET /api/grocery/remove?id=<entryId>` (dev-only GET)

5. In `convex/seed.ts`, give the demo user three entries: "spinach" (matches a food), "oat milk", and "bananas". `/api/dev/seed` clears and recreates them.
   Verify: after `/api/dev/seed`, `/api/grocery/list` returns the three entries.

6. When the designer's screen lands, build `app/_components/GroceryList.tsx` and put it where the design places it. It reads `grocery.list`, adds with the `foods.catalog` suggestions, and toggles on tap. Until then, a plain page at `app/grocery/page.tsx` tagged `// TODO(release): replace with the designed grocery screen` is enough for the demo.
   Verify: in the running app, add an entry, check it, uncheck it, and scan or manually add a matching item to see it check off.

## File ownership

This plan owns `convex/grocery.ts`, `convex/model/grocery.ts`, `lib/grocery.ts` and its test, `app/api/grocery/`, `app/_components/GroceryList.tsx`, and the grocery page. It adds one call each to `convex/receipts.ts` and `convex/itemEdits.ts`, which no other P2 plan touches. p2-03 also edits `convex/seed.ts`; keep each plan's seed code in its own helper function so the merge is two added calls.

## Interfaces delivered

| Convex function | Kind | Test route |
| --- | --- | --- |
| `grocery.list()` | query | `GET /api/grocery/list` |
| `grocery.add({ name, foodId? })` | mutation | `GET /api/grocery/add?name=` |
| `grocery.toggle({ entryId })` | mutation | `GET /api/grocery/toggle?id=` |
| `grocery.remove({ entryId })` | mutation | `GET /api/grocery/remove?id=` |

`grocery.list` returns `groceryItems` documents (`{ _id, name, foodId?, checkedAt?, checkedBy? }`). `add` returns the new id. `toggle` returns `{ entryId, checkedAt: number | null }`.

## Progress

- [x] 1. `lib/grocery.ts` and tests
- [x] 2. `convex/grocery.ts`
- [x] 3. Check-off on confirm and manual add
- [x] 4. `/api` routes
- [x] 5. Seed entries
- [x] 6. Frontend (the design v6 screen at `app/grocery/page.tsx`)

## Validation

- `npm run lint`, `npm run typecheck`, and `npm test` pass.
- Confirming a scanned receipt that includes a listed food checks that entry off without a tap.
- A user cannot read, toggle, or remove another user's entries.

## Decision log

- 2026-10-24: Personalized hints are out of this plan and moved to p3, so the list can ship for the demo.
- 2026-10-24: Name matching is exact after lowercasing. Fuzzy matching ("baby spinach" against "spinach") goes through `foodId`, which the receipt parser and manual add already resolve.
- 2026-10-24: Built with the design v6 port, which also adds `groceryItems` from p2-01; the other p2-01 tables are not added. The v6 screen lists newest entries first, so the page sorts by `_creationTime` and `add` deletes an entry with the same name before inserting, which moves it to the top unchecked. Its "clear" link needed `grocery.clearChecked`, which deletes the caller's checked entries.
- 2026-10-24: Design v6 shows one hint per row, so the hints came back from p3 as client-side code: `groceryHint` in `lib/grocery.ts` reads the existing `items.list` queries (wasted, then active, then use-soon pairings from a static map) and needs no schema. The richer hints in p3 ("half your spinach") still need waste amounts per food.

## Surprises

(none yet)
