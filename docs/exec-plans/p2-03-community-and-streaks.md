# P2-03: Friends leaderboard and streaks

Tier: P2. Estimate: 4 to 5 hours for one engineer. Depends on p2-01. Can run in parallel with p2-02 and p2-04.

## Purpose

Give users a reason to keep swiping their cards: a streak on the stats tab, and a weekly leaderboard with friends on the friends tab. This covers "Community tab" and "Gamified tracking" in `docs/PRODUCT.md`. Dollars and pounds wasted already exist from p1-03.

## Context

- Code paths are relative to `web/`. `stats.summary` and `summarizeWaste` are in p1-03.
- v5 (`claude/frontend-prototype-v5-19a533`) dropped the "me" tab. The nav is fridge, recipes, camera, stats, friends. The streak goes on the stats tab, in the third circle that p1-04 filled with "% used" until streaks existed. The leaderboard stays on the friends tab.
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

Leaderboard: `friends.leaderboard()` returns the caller and their friends for the current week (`range: "week"` in `summarizeWaste`):

- each row is `{ userId, name, lbsWasted, usedRate, streakDays, isYou }`, with `lbsWasted` rounded to one decimal
- sorted by `usedRate` high to low, users with no resolved items this week last, ties broken by lower `lbsWasted`
- rank by rate, not pounds, so a user who shops for one and logs nothing does not beat a user who shops for four and logs everything

Friends share only these numbers and their display name, never item names.

Adding friends:

- `friends.inviteCode()` is a mutation that returns the caller's code, creating a 6-character code on first call. Use letters and digits without look-alikes (no 0, O, 1, I) and retry on a collision through the `by_invite_code` index.
- `friends.add({ code })` looks up the code, rejects the caller's own code, an unknown code, and an existing friendship, then inserts both `friendships` rows. Entering a code is the consent, so there is no pending state.
- `friends.remove({ friendId })` deletes both rows.
- An invite link is `/friends?invite=<code>`. The friends page reads the param and asks "add <name> as a friend?" before calling `add`.

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

6. Stats tab: the third circle in `StatCircles` shows `stats.streak` as "N days" instead of "% used". Keep `usedRate` in the period table.
   Verify: in the running app, tossing an item from a swipe card drops the streak to 0.

7. Friends tab: `app/friends/page.tsx` reads `friends.leaderboard` and passes it to `Leaderboard`. Enable "+ add a friend": it shows the user's invite link with a copy button and a field to paste a friend's code. Use the designer's dialog if it has landed. Handle `?invite=`. Remove `demoLeaderboard` from `app/_demo/fixtures.ts` and the `TODO(release)` line in the friends page.
   Verify: as the demo user, the friends tab shows the seeded leaderboard and pasting a seeded friend's code after removing them adds them back. Once sign-in exists, in two browsers signed in as different users, user A opens user B's invite link, confirms, and each sees the other on the leaderboard.

## File ownership

This plan owns `convex/friends.ts`, `convex/stats.ts`, `convex/model/stats.ts`, `lib/streak.ts` and its test, `app/api/friends/`, `app/api/stats/streak/`, `app/friends/page.tsx`, `app/_components/Leaderboard.tsx`, `app/_components/WasteStats.tsx`, and `demoLeaderboard` in `app/_demo/fixtures.ts`. p2-02 also edits `convex/seed.ts`; keep this plan's seed code in its own helper function.

## Interfaces delivered

| Convex function | Kind | Test route |
| --- | --- | --- |
| `stats.streak()` | query | `GET /api/stats/streak` |
| `friends.inviteCode()` | mutation | `GET /api/friends/invite-code` |
| `friends.add({ code })` | mutation | `GET /api/friends/add?code=` |
| `friends.remove({ friendId })` | mutation | `GET /api/friends/remove?id=` |
| `friends.leaderboard()` | query | `GET /api/friends/leaderboard` |

`friends.add` returns `{ friendId, name }` and throws on the cases above with a message the UI can show. `friends.leaderboard` returns the rows described in Behavior, already sorted.

## Progress

- [ ] 1. `lib/streak.ts` and tests
- [ ] 2. `convex/model/stats.ts` and `stats.streak`
- [ ] 3. `convex/friends.ts`
- [ ] 4. `/api` routes
- [ ] 5. Seed friends
- [ ] 6. Stats tab streak
- [ ] 7. Friends tab

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

## Surprises

(none yet)
