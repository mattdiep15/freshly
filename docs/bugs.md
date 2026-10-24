# Known bugs

Open bugs that are known and not yet fixed. Add the date found, where it lives, how to reproduce it, and a proposed fix. Delete the entry in the commit that fixes it.

## A misread receipt year dates every item from the wrong year

Found 2026-10-24 during p1-04 part A (Gemini). Severity: food safety if the year reads late, wrong reminders if it reads early. Not fixed.

`receipts.saveParsed` in `web/convex/receipts.ts` uses the model's `purchasedAt` as given, and `expiryFor` counts every shelf-life range from it. Nothing checks that the date is plausible. On one Gemini parse of `tj_test_1.pdf`, the model read 10-15-2026 as 2023-10-15, so every item on the receipt was dated three years in the past and would show as expired the moment it was confirmed. A year read too late (for example 2027) would push every date a year out, which is the unsafe direction.

How often: 1 wrong year in 4 dated reads with `gemini-3.8-flash` (`tj_test_1.pdf` wrong once in 3 parses, `costco_test_2.jpeg` right in 1). That sample is too small to give a rate. Claude read the dates correctly in the p1-02 live check. A daily quota cut the measurement short (see p1-04 Surprises).

Reproduce, with `npm run dev` running from `web/`, `GEMINI_API_KEY` set, and the test receipts in `web/data/`:

1. Open `/api/dev/parse-test?name=tj_test_1.pdf` a few times and note each `receiptId`.
2. Open `/api/receipts/get?id=<receiptId>` for each. Most show `purchasedAt` 2026-10-15. A bad run shows a different year, and its drafts' `expiresAt` values are years in the past.

Proposed fix, about 20 minutes plus a test in `web/lib/`:

- Add a pure function in `web/lib/` that takes the model's date and the upload time and returns the date to use. If the date is after the upload time, or more than 60 days before it, fall back to the upload time, the same fallback `costco_test_1.jpeg` uses when no date is printed.
- Call it in `saveParsed` and record when it fell back, so the review screen can ask the user to confirm the purchase date.

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
