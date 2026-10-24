# P2: Social, gamification, and shopping

Tier: P2. Status: draft. Not ready to execute until P1 lands and the designer has screens for these features. Estimates come once scope is agreed.

## Purpose

Give users a reason to keep logging outcomes (friends and streaks) and use their waste history to change what they buy next. This covers Priority 2 in `docs/PRODUCT.md`: the community tab, gamified tracking, the grocery list with personalized recommendations, location-based reminders, and takeout leftovers.

Every feature here reads from P1 data: `items` with `fractionWasted`, `priceCents`, and `weightGrams`, and the `stats.summary` logic from p1-03.

## Features

### Community tab and leaderboard

The product spec describes a Beli-style tab with a leaderboard for food waste and cooking responsibly.

Backend sketch:
- `friendships` table (`userId`, `friendId`, `status: "pending" | "accepted"`), with an invite code or username search to add friends.
- `userStats` table, one row per user per ISO week: `itemsUsed`, `itemsWasted`, `wastedCents`, `wastedGrams`. Updated inside `items.resolve` so the leaderboard does not recompute every user's history.
- `community.leaderboard({ range })` ranks the user and their friends by `usedRate`. Rank by rate, not by pounds saved, so someone with a small fridge can compete with someone who shops for four.
- Share rates and totals with friends by default, not item names. Item-level sharing would need a setting.

Open questions: Is there a global leaderboard or friends only? What does "cooking food responsibly" count, given that P1 does not track cooking?

### Gamified tracking

Streaks, dollars wasted, pounds wasted. The dollar and pound numbers already exist from p1-03.

Backend sketch:
- Add `currentStreak` and `longestStreak` to the user's profile, updated in `items.resolve`.
- Streak definition is a product decision. One candidate: consecutive weeks with `usedRate` of at least 80%. A daily streak would punish users who shop once a week.

### Grocery list and personalized recommendations

Users write what they want to buy next, and the app warns about past waste ("last time you bought too much X").

Backend sketch:
- `groceryItems` table: `userId`, `name`, `foodId?`, `checked`, `createdAt`. CRUD mutations.
- On `items.confirmDrafts` (p1-02), check off list entries whose `foodId` matches a confirmed item.
- `grocery.hints()`: for each list entry with a `foodId`, look at the user's last purchases of that food. If at least two purchases averaged `fractionWasted` above 0.4, return a hint such as "You threw out about half your spinach the last 3 times. Get the small bag?"

### Real prices for items without a receipt price

Added 2026-10-24. Dollars wasted (p1-03 stats, Wrapped Waste in p3) uses `items.priceCents`, which only receipt items have. Manual adds and takeout leftovers have no price, so their waste counts in pounds but not dollars.

Apify has grocery price scrapers: [Instacart Scraper](https://apify.com/piotrv1001/instacart-scraper) (many US chains through Instacart, listed from $5.00 per 1,000 products) and [Kroger Scraper](https://apify.com/getascraper/kroger-scraper) (price, unit price, and stock per store, from $3.30 per 1,000 products). Both are small community actors; test them on a few products before building on them.

Backend sketch:

1. When an item is created without `priceCents`, schedule an action that searches one store for the food's name and saves the median unit price as `estimatedPriceCents`, marked as an estimate.
2. Cache prices per food and ZIP code for a week, since prices vary by location and change slowly.
3. Waste stats use `priceCents` when present and `estimatedPriceCents` otherwise, and the UI marks the estimated part ("about $4, estimated").

The same price data could feed the grocery-list hints ("the small bag is $2 less").

### Location-based reminders

Ping users when they are eating out ("you have X food left") and at the grocery store ("what would go well with what's left").

This is the riskiest P2 item. A website cannot watch location in the background, and web push cannot be triggered by entering a place while the site is closed. Options:

1. A "Shopping now" button that the user taps at the store. The backend returns `useSoon` items and items to skip based on grocery hints. No location needed. Recommended for the hackathon.
2. Location checks only while the app is open, matched against a places API. Works only when the user already has the app open.
3. A native wrapper (Capacitor, Expo) with background geofencing. Real background pings, but a much larger build.

Decide between these with the designer before writing backend code.

### Takeout leftovers

Track restaurant leftovers the same way as groceries.

Backend sketch:
- Add `kind: "grocery" | "leftover"` to `items` (default `grocery`).
- `items.addLeftover({ name, restaurant? })` uses the FDA chart leftover rows already in `foods` ("Meat leftovers, cooked meat dishes: 3 to 4 days") and sets `location: "fridge"`.
- Leftovers flow through the same reminders and swipe cards with no other changes.

This is small and reuses everything. It is a candidate to pull into P1 if there is time.

## Suggested order

1. Takeout leftovers (smallest, reuses P1)
2. Grocery list and hints
3. Estimated prices for unpriced items, after the leftovers and grocery list exist to use them
4. `userStats` and streaks
5. Friends and leaderboard
6. Location reminders, after the option above is chosen

## Decision log

(none yet)
