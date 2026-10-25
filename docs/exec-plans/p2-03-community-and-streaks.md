# P2-03: Friends leaderboard and streaks

Tier: P2. Estimate: 4 to 5 hours for one engineer. Depends on p2-01. Can run in parallel with p2-02 and p2-04.

## Purpose

Give users a reason to keep swiping their cards: a streak in the "my numbers" view and a weekly leaderboard in the "friends" view of `/community`. This covers "Community tab" and "Gamified tracking" in `docs/PRODUCT.md`. Dollars and pounds wasted already exist from p1-03.

## Context

- Code paths are relative to `web/`. `stats.summary` and `summarizeWaste` are in p1-03.
- v6 (#23) merged the stats and friends tabs into one page, `app/community/page.tsx`, with a "my numbers / friends" switch. `/stats` and `/friends` redirect there with `?view=numbers` or `?view=friends`; the page reads `view` once, stores it through `setCommunityView` in `app/_components/useCommunityView.ts`, and replaces the URL with plain `/community`.
- The streak goes in `NumbersView`, in the third circle of `StatCircles` that p1-04 filled with "% used" until streaks existed. The leaderboard and the add-friend button go in `FriendsView`, which renders a disabled "+ add a friend" button and `demoLeaderboard`.
- `app/_components/Leaderboard.tsx` already renders `{ name, lbsWasted, streakDays, isYou }[]` from `demoLeaderboard` in `app/_demo/fixtures.ts`. This plan feeds it real data and keeps the component as is.
- The design counts the streak in days. A streak that needs activity every day would punish students who shop once a week, so this plan counts days without waste instead (see Behavior).
- `friendships` (two rows per pair) and `profiles.inviteCode` are in p2-01.

## Prerequisite: sign-in

Moved from the retired `p2-social-and-shopping.md` (added there in #19). Waste is already stored per user. Every `items` row has a `userId`, and every public function finds the user through `getUserId` in `convex/model/auth.ts`. Convex Auth with the Password provider is installed (`convex/auth.ts`), but no page calls `signIn`, so everyone who opens the app is the seeded demo user through the `ALLOW_DEMO_USER` fallback.

The demo does not need sign-in: steps 1 to 6 work with the demo user and the seeded friends from step 5. Adding a real friend by invite link (step 7's last check) does, and real users need it before launch:

1. Add sign-up and sign-in pages with `useAuthActions` from `@convex-dev/auth/react`. README open question 1 still asks whether to switch to Clerk.
2. Create the `profiles` row on first sign-in, with `utcOffsetMinutes` from the browser (p1-04 open question 4). `profiles.updateSettings` throws until that row exists.
3. Remove the demo-user fallback (the `TODO(release)` in `convex/model/auth.ts`) and keep the demo account as an ordinary seeded user.

This is not in the estimate above.

## Behavior

Streak, in `lib/streak.ts`: `streakDays({ lastWasteAt, firstItemAt, now, utcOffsetMinutes })` is pure and returns local calendar days since the last waste event, or since the user's first item if they have never wasted anything. No items returns 0. A waste event is either:

- an item resolved as `wasted` (its `resolvedAt`), or
- an `expired` item still waiting for a swipe (its `expiresAt`), so ignoring the swipe cards does not keep a streak alive.

Example: a user's first item was 12 days ago and they tossed yogurt 4 days ago, so the streak is 4. An item expiring today that they have not swiped resets it to 0.

Leaderboard: `friends.leaderboard()` returns the caller and their friends for the current calendar week, Monday 00:00 in each person's time zone (`range: "week"` in `summarizeWaste`):

- each row is `{ userId, name, lbsWasted, usedRate, streakDays, isYou }`, with `lbsWasted` rounded to one decimal
- sorted by `usedRate` high to low, users with no resolved items this week last, ties broken by lower `lbsWasted`
- rank by rate, not pounds, so a user who shops for one and logs nothing does not beat a user who shops for four and logs everything

Friends share only these numbers and their display name, never item names.

Adding friends:

- `friends.inviteCode()` is a mutation that returns the caller's code, creating a 6-character code on first call. Use letters and digits without look-alikes (no 0, O, 1, I) and retry on a collision through the `by_invite_code` index.
- `friends.add({ code })` looks up the code, rejects the caller's own code, an unknown code, and an existing friendship, then inserts both `friendships` rows. Entering a code is the consent, so there is no pending state.
- `friends.remove({ friendId })` deletes both rows.
- An invite link is `/community?view=friends&invite=<code>`. `view=friends` reuses the existing switch, and the page keeps the code after it clears the URL, then the friends view asks "add <name> as a friend?" before calling `add`.

## Steps

1. Write `lib/streak.ts` and `lib/streak.test.ts`. Cover: no items gives 0; no waste counts from the first item; a wasted item resets the count; a pending swipe resets it; local days at UTC-7 (a toss at 23:30 local still counts as that local day).
   Verify: `npm test` passes.

2. Move the item loading out of `stats.summary` into `convex/model/stats.ts`: `loadResolved(ctx, userId)` (what `summary` does now) and `streakInputs(ctx, userId)` (the latest wasted `resolvedAt`, the oldest pending `expiresAt`, and the earliest `purchasedAt`). Add `stats.streak()` returning `{ streakDays }`. `stats.summary` keeps its shape.
   Verify: `/api/stats/summary?range=week` returns the same numbers as before the move.

3. Write `convex/friends.ts` with `inviteCode`, `add`, `remove`, and `leaderboard`. `leaderboard` calls the step 2 helpers once per person.
   Verify: through the routes in step 4, the demo user adds a seeded friend's code, and `leaderboard` lists both.

4. Add `/api` routes following p1-01:
   - `GET /api/stats/streak`
   - `GET /api/friends/invite-code` (dev-only GET, since it can write)
   - `GET /api/friends/add?code=` (dev-only GET)
   - `GET /api/friends/remove?id=` (dev-only GET)
   - `GET /api/friends/leaderboard`

5. In `convex/seed.ts`, add four friend users (maya, theo, dev, nina) with profiles, invite codes, friendships with the demo user, and used and wasted items resolved over the last two weeks. Pick the items so the leaderboard order and streaks resemble `demoLeaderboard`. Fake data stays in the seed, per `CLAUDE.md`.
   Verify: after `/api/dev/seed`, `/api/friends/leaderboard` returns five rows with the demo user marked `isYou`.

6. My numbers view: in `app/community/page.tsx`, `NumbersView` passes `stats.streak` to `StatCircles`, and its third circle shows "N days" instead of "% used". Keep `usedRate` in the period table.
   Verify: in the running app, tossing an item from a swipe card drops the streak to 0.

7. Friends view: `FriendsView` in `app/community/page.tsx` reads `friends.leaderboard` and passes it to `Leaderboard`. Enable "+ add a friend": it shows the user's invite link with a copy button and a field to paste a friend's code. Use the designer's dialog if it has landed. Handle `/community?view=friends&invite=<code>`. Remove `demoLeaderboard` from `app/_demo/fixtures.ts` and the `TODO(release)` line in `FriendsView`.
   Verify: as the demo user, the friends view shows the seeded leaderboard and pasting a seeded friend's code after removing them adds them back. Once sign-in exists, in two browsers signed in as different users, user A opens user B's invite link, confirms, and each sees the other on the leaderboard.

## File ownership

This plan owns `convex/friends.ts`, `convex/stats.ts`, `convex/model/stats.ts`, `lib/streak.ts` and its test, `app/api/friends/`, `app/api/stats/streak/`, `NumbersView` and `FriendsView` in `app/community/page.tsx`, `app/_components/Leaderboard.tsx`, `app/_components/WasteStats.tsx`, and `demoLeaderboard` in `app/_demo/fixtures.ts`. p2-02 also edits `convex/seed.ts`; keep this plan's seed code in its own helper function.

## Interfaces delivered

| Convex function | Kind | Test route |
| --- | --- | --- |
| `stats.streak()` | query | `GET /api/stats/streak` |
| `friends.inviteCode()` | mutation | `GET /api/friends/invite-code` |
| `friends.add({ code })` | mutation | `GET /api/friends/add?code=` |
| `friends.remove({ friendId })` | mutation | `GET /api/friends/remove?id=` |
| `friends.invitePreview({ code })` | query | `GET /api/friends/invite-preview?code=` |
| `friends.leaderboard()` | query | `GET /api/friends/leaderboard` |

`friends.add` returns `{ friendId, name }` and throws on the cases above with a message the UI can show. `friends.leaderboard` returns the rows described in Behavior, already sorted.

## Progress

- [x] 1. `lib/streak.ts` and tests
- [x] 2. `convex/model/stats.ts` and `stats.streak`
- [x] 3. `convex/friends.ts`
- [x] 4. `/api` routes
- [x] 5. Seed friends
- [x] 6. My numbers streak
- [x] 7. Friends view (demo user and seeded friends; two real accounts wait on sign-in)

## Validation

- `npm run lint`, `npm run typecheck`, and `npm test` pass.
- The leaderboard never returns item names or another user's items.
- After sign-in exists, two real accounts can add each other by invite link and see each other's weekly numbers.
- A pending swipe card or a toss resets the streak to 0.

## Open questions

1. Leaderboard order. The v5 fixture sorts by pounds wasted. This plan sorts by weekly used rate (see Behavior). Confirm with the designer.
2. Global leaderboard. This plan is friends only. A global board would show strangers' numbers and needs a privacy setting.
3. "Cooking food responsibly" from the spec. P1 does not track cooking, so the leaderboard counts waste only. The recipe cooking card in v5 could log a "cooked" event later.

## Decision log

- 2026-10-24: Streaks count days without waste, so a weekly shopper keeps a streak. An unswiped expired item counts as waste, so ignoring cards does not protect a streak.
- 2026-10-24: Leaderboard and streaks compute on read, with no `userStats` table (p2-01).
- 2026-10-24: Friends join by invite code or link, not by searching names, so users cannot browse other accounts.
- 2026-10-24: Re-pointed at the v6 `/community` page (#23). `app/stats/page.tsx` and `app/friends/page.tsx` are gone, so the streak goes in `NumbersView` and the leaderboard in `FriendsView`, and the invite link is `/community?view=friends&invite=<code>` to reuse the page's `?view=` handling.
- 2026-10-24: p2-01 was not run on its own. This plan added only `friendships`, `profiles.inviteCode`, and `by_invite_code` to `convex/schema.ts`, in the p2-01 shape; p2-04 adds the recipe table on its branch.
- 2026-10-24: `streakInputs` uses the newest pending `expiresAt`, not the oldest the step 2 text named. The latest waste event bounds the streak, so the oldest would overstate it.
- 2026-10-24: Added `friends.invitePreview({ code })`, a query returning `{ status: "ok" | "friends" | "self" | "unknown", name? }`, so the invite link can say "add <name> as a friend?" before anything is written.
- 2026-10-24: Leaderboard ties after `lbsWasted` break by name, so the order is stable. A friend list is capped at 50 (`MAX_FRIENDS`).
- 2026-10-24: v6's period table had no used-rate column, so "% used" became its fourth column when the streak took the third circle.
- 2026-10-24: Stats use calendar periods, not rolling windows (team call). "Week" starts Monday 00:00 and "month" on the 1st, both in the user's time zone (`periodStart` in `lib/wasteStats.ts`). With rolling windows, ranks shifted every day as old items aged out; now they move only when someone resolves an item, and everyone resets on Monday. This changes p1-03's `summarizeWaste`, which now takes `utcOffsetMinutes`.
- 2026-10-24: Dollars wasted shows to the user as a "$ wasted" column in the period table (team call). The leaderboard does not return it, so friends never see it.
- 2026-10-24: The leaderboard shows a "% used" column, since it sorts on that number. The plan said to keep `Leaderboard.tsx` as is, but without the column the order looked arbitrary. Phones show rank, name, % used, and streak, and drop lbs.
- 2026-10-24: An expired item still waiting for a swipe counts as wasted at its expiry in every stat, not only the streak: % used, lbs and $ wasted, and the leaderboard. It uses the user's toss fraction. Without this, a user could swipe only the items they used and skip the rest to show 100%. Swiping the card later moves it to used or wasted as usual.
- 2026-10-24: No designer dialog has landed, so "+ add a friend" opens an inline panel under the heading. The caller's row shows "you", as the old fixture did.
- 2026-10-24: Design v7 replaces the earlier call that friends never see dollars. The leaderboard returns each person's weekly `centsWasted` and drops the lbs column; `profiles.hideDollarsFromFriends` (a "share $ wasted with friends" switch in settings, on by default) makes it `null` for everyone but the owner, and the row shows "private". The seeded nina has it on.
- 2026-10-24: Design v7's my-numbers view covers the last four calendar weeks: the circles show $ wasted with $ saved under it (the price of items marked used), the streak, and use rate over those weeks, and the table has one row per week. This adds `stats.weeks()` (`GET /api/stats/weeks`), `weeklySummaries` and `summarizeBetween` in `lib/wasteStats.ts`, and `savedCents` on every summary. The v7 "1 freeze left" line is left out because streak freezes are not built.

## Surprises

- A streak longer than the days since Monday means nothing was wasted this week, so the old fixture's rows (theo: 0.7 lbs this week, 9-day streak) cannot happen. The seeded friends follow the definition: maya and theo show 0 lbs.
- The seeded demo user ranks last after a reseed. Its three unswiped cards count as wasted, so its week is 1 used of 7 (14%), below nina's 20%. Swiping one card as used moves it to 29%, above nina. Its streak starts at 1, since its three swipe cards expired yesterday; tossing one drops it to 0.
- The p1 seed places the demo user's resolved items 1 to 11 days back, so a reseed early in the week puts most of them in last week. On a Monday the demo user has nothing resolved this week and ranks last. The friends' seed places this week's items inside the current week on any day.
- The fridge holds a swipe decision for a 5-second undo window, and a full page reload inside that window drops the decision without saving it.
- The worktree's `web/.env.local` pointed at the team dev deployment. Testing used a local anonymous deployment instead (`CONVEX_AGENT_MODE=anonymous npx convex dev`), with `ALLOW_DEMO_USER=true` set on it.
