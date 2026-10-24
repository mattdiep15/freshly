# Known bugs

Open bugs that are known and not yet fixed. Add the date found, where it lives, how to reproduce it, and a proposed fix. Delete the entry in the commit that fixes it.

## Moving an expired item to the freezer gives it a fresh freezer date

Found 2026-10-24 during p1-02. Severity: food safety. Not fixed.

`itemEdits.update` in `web/convex/itemEdits.ts` recomputes `expiresAt` with `expiryFor(food, newLocation, item.purchasedAt)` when only `location` changes. The freezer range is counted from the purchase date and ignores how long the item already sat in the fridge. Freezing stops spoilage but does not undo it, so meat that passed its fridge date before it was frozen is not safe to eat later.

Reproduce, with `npm run dev` running from `web/`:

1. Open `/api/dev/parse-test?name=costco_test_2.jpeg&mock=1`, then `/api/receipts/get?id=<receiptId>`. Ground beef was bought 2026-10-06 and its fridge date is 2026-10-07 (FDA, 1 to 2 days).
2. Any day after 2026-10-07, open `/api/item-edits/update?id=<ground beef itemId>&location=freezer`.
3. The item comes back `active` with `expiresAt` 2027-01-04 (purchase date plus FDA's 90 freezer days). It should not get a freezer date at all.

The same gap applies to an item in `expired` status. It also applies in a milder form to an item frozen on day 1 of a 2-day fridge life, which keeps the full freezer range even though FDA's freezer times assume the food was frozen fresh.

Proposed fix, about 15 minutes plus a test in `web/lib/expiry.test.ts`:

- Give `expiryFor` (`web/lib/expiry.ts`) the move time. When the move is to the freezer and the item's current `expiresAt` has passed, return the current date unchanged (or reject the move with a readable error) instead of a new freezer date.
- Count the freezer range from the move time, not the purchase date, so freezing on day 1 still earns the full range and later freezing never extends a date already past.
- Decide with the team whether a user-set `expiresAt` (`expirySource: "user"`) should also block the recompute.
