# Known bugs

Open bugs that are known and not yet fixed. Add the date found, where it lives, how to reproduce it, and a proposed fix. Delete the entry in the commit that fixes it.

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

## Items can't be dragged between storage sections (later)

- Found: 2026-10-24, asked for while reviewing #40.
- Where: an item changes storage only through the fridge, freezer, and pantry buttons (`app/_components/ui/LocationPicker.tsx`) in `FoodCard`'s detail view. #40 splits the fridge tab into one section per location in `app/_components/FoodList.tsx`, so dragging a card from one section to another is the move users will try.
- Reproduce: on the fridge tab, drag a card from the fridge section toward the freezer section. Nothing moves. The only way is to open the card and tap "freezer".
- Proposed fix: on drop, call `itemEdits.update({ itemId, location })`, the same mutation the buttons call. Keep the buttons for keyboard and screen-reader users.
- Watch for: HTML5 drag and drop is unreliable on touch screens, and the app is built phone-first. Pointer events with a long press to start a drag need no library. dnd-kit would also work, but `CLAUDE.md` says to ask before adding a UI library. Desktop cards open on hover (`hoverOpens` in `FoodList.tsx`), so turn hover-open off during a drag. #40 hides empty sections, so show all three as drop targets while a drag is active. Expired cards hide the buttons because a move keeps a passed date (`expiryAfterMove` in `lib/expiry.ts`), so don't let them be dragged either.
