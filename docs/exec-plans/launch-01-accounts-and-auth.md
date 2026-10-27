# Launch-01: Accounts, sign-in, and per-user data

Tier: Launch. Estimate: 1.5 to 2 days for one engineer. Overview: [launch-00-free-tier-overview.md](launch-00-free-tier-overview.md).

## Purpose

Every visitor today shares the demo user's fridge. Real users need their own account, a sign-in that works on an iPhone Home Screen app, and a way to delete their data. This plan adds sign-in with services that cost nothing at our scale and removes the demo fallback from prod.

## Context

State on 2026-10-26:

- `@convex-dev/auth` is installed. `convex/auth.ts` configures only the `Password` provider, `convex/http.ts` adds the auth routes, and `app/ConvexClientProvider.tsx` wraps the app in the client-side `ConvexAuthProvider`. No page calls `signIn`, so nobody can sign in yet.
- `getUserId` in `convex/model/auth.ts` is the one place that resolves the user. When nobody is signed in and `ALLOW_DEMO_USER=true`, it returns the demo user (`TODO(release)`). Prod has `ALLOW_DEMO_USER=true` today.
- Every public query, mutation, and action calls `getUserId`, directly or through an internal query (`receiptsNode.addManual` goes through `itemEdits.manualInput`). Per-user tables (`items`, `receipts`, `groceryItems`, `friendships`, `pushSubscriptions`, `notifications`, `recipeSuggestions`, `foodFamiliarity`) are indexed by `userId`. `foods` is shared by design. So the data is already separated per account; what is missing is a way to become an account other than the demo user.
- Profiles are created only by `convex/seed.ts`. A new user would have no `profiles` row, and `profiles.update` throws "Profile not found".
- The JSON routes under `app/api/` call Convex without an auth token. They return 404 in production (`app/api/_lib/dev-only.ts` covers the dev ones) and only work through the demo fallback.

## Choices

Providers, in the order we recommend:

1. Google sign-in (`@auth/core/providers/google`). Free, one tap on a phone, and no password for us to store or reset. Needs an OAuth client in Google Cloud, and Google's consent screen asks for a privacy policy link.
2. Email one-time code through Resend (`@auth/core/providers/resend`, set up as an OTP provider in Convex Auth). Free up to 3,000 emails a month and 100 a day, which covers sign-ins for a few hundred users. Needs DNS records on freshly.cooking.
3. Drop `Password`. A password needs reset emails anyway, which means Resend plus a reset flow, so email codes cover the same users with less code.

Clerk is the main alternative. It has a hosted sign-in UI, but it adds a second vendor and a webhook or JWT setup with Convex, while Convex Auth is already installed and keeps users in our own `users` table.

Convex Auth also ships an `Anonymous` provider. It could replace the shared demo with a private trial fridge per visitor, but turning an anonymous account into a Google account is extra work, so leave it out of this plan.

## Steps

1. Providers. In `convex/auth.ts`, replace `Password` with Google and a Resend OTP provider. Set `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_RESEND_KEY`, and `SITE_URL` on the dev and prod Convex deployments, and add them to `scripts/setup-convex.mjs` prompts. Add the Google redirect URI for each deployment's `CONVEX_SITE_URL`.
   Verify: `npx convex env list` shows the keys on dev, and the Google redirect lands back on the app.
2. Profile on first sign-in. Add `callbacks.afterUserCreatedOrUpdated` to `convexAuth` and insert a `profiles` row when the user has none: `displayName` from the Google name or the email's local part, `digestHour: 9`, and `utcOffsetMinutes: 0` until step 4 sets it. Put the defaults in `lib/` with a test, next to the seed's values.
   Verify: a new Google account gets exactly one `profiles` row, and signing in again does not add a second.
3. Sign-in page and gate. Add `app/signin/page.tsx` with "Continue with Google" and an email field that asks for the code. In the root layout, show the sign-in page when `useConvexAuth()` reports signed out, so pages never render with a missing user. Add sign-out to `SettingsCard`. Test the Google redirect from the Home Screen app on an iPhone, since it opens outside the app's window.
   Verify: a signed-out browser sees only the sign-in page, and a signed-in one sees its own empty fridge.
4. Time zone. On sign-in, send the browser's time zone to a `profiles.setTimeZone` mutation. p2-05 step 3 already suggests storing an IANA zone instead of an offset, so do that here and update `lifecycle.tick` to compute the local hour from it.
   Verify: a profile in `America/Los_Angeles` gets its digest at 9am local time on both sides of a daylight saving change (unit test in `lib/digest.test.ts`).
5. Delete account. Add a `profiles.deleteAccount` mutation that removes the user's `items`, `receipts` and their stored files, `groceryItems`, both directions of `friendships`, `pushSubscriptions`, `notifications`, `recipeSuggestions`, `foodFamiliarity`, the profile, and the auth tables' rows for the user. Large users may need it split into a scheduled chain. Add the button to `SettingsCard` behind a confirm step.
   Verify: after deletion, `npx convex data` shows no rows with that `userId` in any table.
6. Turn off the demo user. Remove the fallback from `getUserId`, and remove `ALLOW_DEMO_USER` from prod. Keep `convex/seed.ts` and the `dev:*` functions for the dev deployment, or delete them with their `TODO(release)` tags if the team no longer needs the demo.
   Verify: `npx convex env get ALLOW_DEMO_USER --prod` prints nothing, and a signed-out call to `api.items.list` throws "Not signed in".
7. Privacy policy and terms. Add a short `/privacy` page: what we store (receipt images until parsed, items, prices), which services see it (Anthropic for receipts, Google for public web text only, Apify for search queries), and how to delete an account. Link it from the sign-in page and the Google consent screen.

## Validation

- Two accounts on two phones each see only their own fridge, receipts, grocery list, and push reminders.
- Friends added by invite code between those two accounts show on each other's leaderboard (p2-03's open item).
- `grep -rn "DEMO_EMAIL\|ALLOW_DEMO_USER" web/convex` matches only `seed.ts` and `dev.ts`, or nothing.

## Open questions

1. Keep a public demo for people who read the Devpost? A demo account with a sign-in button would share data between visitors again; the `Anonymous` provider would not.
2. Is a student email (`.edu`) required? It would help the "students" focus but blocks graduates and friends.

## Decision log

- 2026-10-26: Proposed Google plus email codes on Convex Auth, without passwords.
