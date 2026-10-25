# Known bugs

Open bugs that are known and not yet fixed. Add the date found, where it lives, how to reproduce it, and a proposed fix. Delete the entry in the commit that fixes it.

## Receipt review flags are saved but never shown

- Found: 2026-10-24, while tracing flows for the system map.
- Where: `convex/receipts.ts` writes `reviewFlags` in `saveResult` (`implausible_date`) and `saveVerification` (Gemini's `store_mismatch`, `date_mismatch`, `total_mismatch`). `app/_components/ScanFlow.tsx` reads the receipt but never renders the flags.
- Reproduce: scan a receipt whose printed date is more than 60 days old. The drafts are dated from the upload time and the receipt gets `implausible_date`, but the review screen looks the same as for a clean receipt. With `GEMINI_API_KEY` set, a receipt where Gemini reads a different date or total gets a mismatch flag, which is also invisible. The Gemini check currently changes nothing a user can see.
- Proposed fix: on the review screen, show one line per flag above the drafts. For `implausible_date` and `date_mismatch`, add a date picker that calls `receipts.setPurchasedAt`. It is already a public mutation, and it re-dates the drafts and clears both date flags. For `store_mismatch` and `total_mismatch`, show both readings and a dismiss button.

## Items already in the fridge can't move to the freezer

- Found: 2026-10-24.
- Where: `itemEdits.update({ location })` and `expiryAfterMove` in `lib/expiry.ts` work. Since #34, the review screen's fridge, freezer, and pantry buttons call them for drafts. Nothing on the fridge page (`app/fridge/page.tsx`, `FoodCard`) calls them for an active item, so the only path is the dev route `/api/item-edits/update`.
- Reproduce: confirm a receipt with chicken breast in the fridge. Two days later, open its card on the fridge tab. There is no way to say you froze it, so it still expires on its fridge date and shows up as a swipe card.
- Proposed fix: add a "move to freezer / fridge" action on `FoodCard`'s detail view that calls `itemEdits.update({ itemId, location })`. The server already keeps a date that has passed and restarts the clock from today when the food has `freezerDays`, so the fix is UI only.

## Removing a friend has no UI (later)

- Found: 2026-10-24.
- Where: `friends.remove` in `convex/friends.ts` deletes both friendship rows. Its only caller is the dev route `app/api/friends/remove/route.ts`, which returns 404 in production.
- Reproduce: add a friend by invite code on `/community`, then try to remove them. The leaderboard rows have no remove control.
- Proposed fix: a remove option on a friend's leaderboard row with an in-page confirm step, calling `friends.remove({ friendId })`. Not needed for the demo.

## Expired items don't prompt for a swipe on launch (later)

- Found: 2026-10-24.
- Where: `app/fridge/page.tsx` opens `SwipeTakeover` only through `setReviewing`. It is called when the user taps "review expired item" on a `FoodCard`, or a row tagged check-in. `reviews.pending` already returns every expired item along with `canExtend`.
- Reproduce: let an item expire (or run `/api/dev/seed`, which seeds three expired items), then open the app. The fridge shows the items with a review button, but no card appears until you tap one. Unswiped items count as waste in stats and break the streak, so users who never tap lose credit for food they used.
- Proposed fix: on app open, queue every item from `reviews.pending` and show the cards one after another, oldest expiry first, with a way to skip the rest ("ask me later" already exists as the check-in tag). Show the queue once per session, so dismissing it doesn't bring it back on every navigation.
