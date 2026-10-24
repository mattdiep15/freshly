# P1-01: Backend foundation

Tier: P1. Estimate: about 4 hours for one engineer. Blocks p1-02 and p1-03.

## Purpose

Stand up the Convex backend inside the Next.js app so the rest of P1 has somewhere to live. After this plan, a developer can run the app locally, sign in (or use the dev demo user), and open `http://localhost:3000/api/...` in a browser to call backend functions and see JSON. The shelf-life reference table is loaded from sourced data, and a demo fridge exists for the frontend to build against.

## Context

- Product scope: `docs/PRODUCT.md`, section "Priority 1". Project rules: `CLAUDE.md`. Read both first.
- Shelf-life source: `docs/food_storage_chart.pdf`, the FDA "Refrigerator & Freezer Storage Chart" (March 2018). It covers eggs, deli, meat, poultry, fish, soups, and leftovers. It has no produce, dairy, bread, or pantry goods, which is why the FoodKeeper import in step 7 is required.
- `CLAUDE.md` treats shelf-life numbers as safety claims. Every number in `foods` carries its source, and an item with no sourced value gets no expiry date. The UI then asks the user for one.
- Convex terms used below: a query reads data, a mutation writes data, an action can call external APIs, and functions marked `internal` cannot be called from the browser.

## Scope

In scope: Next.js scaffold, Convex setup, vitest, auth, the full P1 schema, the `foods` reference table, a demo seed, and the `/api` test-route convention.

Out of scope: any UI beyond the default Next.js page, receipt parsing (p1-02), reminders and stats (p1-03).

## Where code goes

Per `CLAUDE.md`:

- `convex/schema.ts` is the only source of truth for data shape.
- `convex/*.ts` holds every read and write. Public functions validate args with `v.*` and call `getUserId`.
- `convex/model/` holds Convex helpers that are not functions, such as `getUserId`.
- `lib/` holds pure domain logic with no React or Convex imports, each file with a test: `lib/expiry.ts` (p1-02), `lib/digest.ts` and `lib/wasteStats.ts` (p1-03).
- `app/api/` holds the browser test routes described below. Route handlers parse arguments and call Convex. No business logic.

## Schema

All P1 tables are defined here so p1-02 and p1-03 can work in parallel without editing the schema at the same time. Field names are a starting point. Change them in this plan first, then in code.

```ts
// convex/schema.ts (sketch)
profiles: {
  userId: Id<"users">,
  displayName: string,
  utcOffsetMinutes: number,      // set by the client on sign-in, used for digest timing
  digestHour: number,            // local hour for the daily reminder, default 9
}  index by_user [userId]

// ShelfLife = { min: number, max: number, source: "fda_chart" | "foodkeeper", ref: string }
// ref points at the exact row, e.g. "FDA chart 2018-03 > Fresh Poultry > Chicken or turkey, parts"
foods: {                          // shared reference data
  name: string,                   // canonical, lowercase: "chicken breast"
  aliases: string[],              // receipt-style names: "bnls chkn brst"
  category: string,               // "poultry", "produce", "dairy", ...
  defaultLocation: "fridge" | "freezer" | "pantry",
  fridgeDays?: ShelfLife,
  freezerDays?: ShelfLife,
  pantryDays?: ShelfLife,
  storageTip?: { text: string, source: "fda_chart" | "foodkeeper" | "llm" },
  freshnessHint?: { text: string, source: "foodkeeper" | "llm" },
  defaultWeightGrams?: number,    // rough estimate for lbs-wasted, not a safety claim
}  index by_name [name]

receipts: {
  userId, fileId: Id<"_storage">, fileType: "image" | "pdf",
  status: "uploaded" | "parsing" | "parsed" | "failed",
  storeName?: string, purchasedAt?: number, totalCents?: number, error?: string,
}  index by_user [userId]

items: {
  userId, receiptId?: Id<"receipts">, foodId?: Id<"foods">,
  name: string, quantity: number, unit?: string,
  priceCents?: number, weightGrams?: number,
  location: "fridge" | "freezer" | "pantry",
  purchasedAt: number,
  expiresAt?: number,             // absent when no sourced shelf life exists and the user has not set one
  expirySource?: "fda_chart" | "foodkeeper" | "user",
  status: "draft" | "active" | "expired" | "used" | "wasted",
  fractionWasted?: number,        // 0..1, set when status becomes used or wasted
  resolvedAt?: number,
}  index by_user_status [userId, status, expiresAt], index by_status_expires [status, expiresAt],
   index by_receipt [receiptId]

foodFamiliarity: { userId, foodId, timesAdded: number, tipViews: number }
  index by_user_food [userId, foodId]

pushSubscriptions: { userId, endpoint: string, p256dh: string, auth: string }
  index by_user [userId], index by_endpoint [endpoint]

notifications: {
  userId, kind: "digest", dateKey: string,  // "2026-10-24" in the user's local time
  title: string, body: string, itemIds: Id<"items">[], readAt?: number,
  undatedCount?: number,          // set when the digest nudged about undated items, for the weekly limit
}  index by_user_date [userId, dateKey]
```

Schema changes made during p1-01 (2026-10-23): `by_user_status` gained `expiresAt` as a third field, so a user's items come back sorted by expiry (queries on `[userId, status]` still work as a prefix). Added `items.by_receipt` for `receipts.get` and `items.confirmDrafts`, `pushSubscriptions.by_endpoint` so `push.saveSubscription` can upsert, and `notifications.undatedCount` so `lifecycle.tick` can limit the undated nudge to once a week. Validators shared by these tables (`location`, `shelfLife`, `itemStatus`, `foodFields`, ...) are exported from `convex/schema.ts`.

Item status flow: `draft` (parsed from a receipt, not yet confirmed) to `active` (in the fridge) to `expired` (past `expiresAt`, waiting for a swipe) to `used` or `wasted`. A user can also mark an `active` item `used` or `wasted` before it expires. Items without `expiresAt` stay `active` until the user resolves them or sets a date.

## The /api test-route convention

The team wants to test backend functions from a browser, without running scripts in a terminal. Each public Convex function that matters gets a thin Next.js route handler under `app/api/` that calls it and returns JSON.

```ts
// app/api/items/use-soon/route.ts
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export async function GET(req: Request) {
  const days = Number(new URL(req.url).searchParams.get("days") ?? 7);
  return Response.json(await fetchQuery(api.items.useSoon, { days }));
}
```

Rules:

- Queries use `GET` with arguments in the query string, so pasting a URL into the browser works.
- Mutations and actions also accept `GET` so they can be triggered from the address bar. Those routes call `devOnly()` from `app/api/_lib/dev-only.ts`, which returns 404 when `NODE_ENV === "production"`. (Folders starting with `_` are not routed.) Anything that has to work in production uses `POST`.
- Route paths mirror the Convex module and function: `api.items.useSoon` becomes `/api/items/use-soon`.
- Route handlers contain no business logic. If a route needs more than argument parsing, the logic belongs in Convex or `lib/`.
- Next.js 16 ships its own docs in `node_modules/next/dist/docs/` (see `AGENTS.md`). Read the route handler guide there before writing routes.

Browser requests to these routes carry no Convex auth token. To make them usable before the sign-in UI exists, `getUserId(ctx)` returns the signed-in user, and if there is none and the Convex env var `ALLOW_DEMO_USER` is `"true"`, it returns the seeded demo user. Set that variable on the dev deployment only, and tag the fallback `// TODO(release): remove demo-user fallback`.

A route that reads no request input (no `req.url`, no headers) calls `await connection()` from `next/server` first, so `next build` never tries to prerender it. See `app/api/dev/seed/route.ts`. A Convex error currently surfaces as a 500 from Next.js; the message is in the dev server log.

## Running locally

1. `npm install`, then `npm run dev`. With no Convex login, `convex dev` uses the local anonymous deployment named in `.env.local` (`CONVEX_DEPLOYMENT=anonymous:anonymous-agent`, backend on `http://127.0.0.1:3210`). On a fresh clone with no `.env.local`, create it once with `CONVEX_AGENT_MODE=anonymous npx convex dev --once`.
2. Set the dev-only env vars on that deployment. Convex Auth needs `JWT_PRIVATE_KEY`, `JWKS`, and `SITE_URL`; `npx @convex-dev/auth` generates and sets all three. Then run `npx convex env set ALLOW_DEMO_USER true`.
3. Open `http://localhost:3000/api/dev/seed`. On an empty deployment it also imports the reference foods.

`npm run build` needs `NEXT_PUBLIC_CONVEX_URL`, because the root layout renders the Convex provider during prerender. A fresh clone with no `.env.local` fails the build until step 1 has run. On Vercel, set `NEXT_PUBLIC_CONVEX_URL` in the project's environment variables.

To move to a real team project, someone runs `npx convex login`, then `npx convex dev --configure existing` (or `new`) and picks the team's project. That rewrites `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` in `.env.local`. Repeat step 2 against the new dev deployment, never the production one, and run `npx convex run foods:importReference`. Local data does not carry over.

## Progress

- [x] 1. Scaffold Next.js at the repo root (2026-10-23: Next.js 16.4, Tailwind 4, `/api/health` live, `npm run typecheck` added)
- [x] 2. Add Convex and a combined dev script (2026-10-23: local anonymous deployment, `concurrently`)
- [x] 3. Add vitest and `npm test` (2026-10-23: vitest 5, `lib/placeholder.test.ts`)
- [x] 4. Add auth and `getUserId` (2026-10-23: client-side `ConvexAuthProvider`, see Decision log)
- [x] 5. Write `convex/schema.ts` (2026-10-23: four additions, listed under Schema)
- [x] 6. Load the FDA chart into `foods` (2026-10-23: 55 rows from `convex/data/fdaChart.script.mjs`)
- [x] 7. Import USDA FoodKeeper into `foods` (2026-10-23: 649 rows from FoodKeeper data v128; milk has no fridge range, see Surprises)
- [x] 8. Add the demo seed and its `/api` route (2026-10-23: 17 items)

## Steps

1. Done. Next.js (App Router, TypeScript, Tailwind) at the repo root with `app/api/health/route.ts` returning `{ ok: true }`.

2. Run `npm install convex`, then `npx convex dev`. The first run creates a dev deployment and writes `NEXT_PUBLIC_CONVEX_URL` to `.env.local`. Wrap the app in `ConvexProvider` through a small client component in `app/`. Change `npm run dev` to run Next.js and `convex dev` together (`concurrently` or `npm-run-all`), and update the commands block in `CLAUDE.md`.
   Verify: `npm run dev` starts both, and the Convex dashboard shows the deployment with no errors.

3. Install `vitest`, add `"test": "vitest run"`, and create `lib/`. Add `npm test` back to the commands block in `CLAUDE.md`.
   Verify: `npm test` runs and passes with a placeholder test, which p1-02 replaces.

4. Install Convex Auth (`@convex-dev/auth`) with the Password provider and follow its Next.js setup. Write `convex/model/auth.ts` exporting `getUserId(ctx)` with the demo-user fallback above. Every public function calls `getUserId` instead of reading auth directly, so swapping to Clerk later touches one file.
   Verify: with no session and `ALLOW_DEMO_USER` unset, a function calling `getUserId` throws "Not signed in".

5. Write `convex/schema.ts` from the sketch above, including `...authTables`.
   Verify: `npx convex dev` pushes the schema without errors.

6. Transcribe the FDA chart into `convex/data/fdaChart.json`, about 60 rows. Each row has a name, aliases, category, and fridge and freezer ranges, and each range gets a `ref` naming its chart section and row. Convert "1 week" to 7 days and "2 months" to 60 days. Record "Don't freeze" as no `freezerDays`. Add the chart's general tips ("Keep meat and poultry in its package until just before using") as `storageTip` on the matching rows with `source: "fda_chart"`. Write an internal mutation `foods.importReference` that upserts by `name` and merges per location, so an FDA fridge range and a FoodKeeper pantry range can sit on the same row with different sources. Running it twice must be safe.
   Verify: run it twice, and the row count is the same both times.

7. Timebox to 90 minutes. USDA publishes the FoodKeeper dataset (the data behind the FoodKeeper app), which covers produce, dairy, bread, and pantry goods. Find the current export on catalog.data.gov, map it into the same JSON shape with `source: "foodkeeper"`, and import it through `foods.importReference`. Where FDA and FoodKeeper both give a value for the same food and location, keep the FDA value. If the import does not work within the timebox, stop and record it under Surprises. Produce and dairy will then have no sourced shelf life, and users set those dates by hand.
   Verify: `foods` has sourced fridge ranges for "milk", "spinach", and "eggs".

8. Write `convex/seed.ts` with an internal mutation `seed.demo`. It creates the demo user and profile and about 15 items: 3 `expired` (waiting for a swipe), items expiring in 1, 3, and 7 days, a few fresh ones, one with no `expiresAt`, and about 8 resolved `used` or `wasted` items from the past two weeks with prices and weights, so stats are not zero. It deletes the demo user's existing items first, so it can be re-run before a demo. Add a public mutation `dev.reseed` that throws unless `ALLOW_DEMO_USER` is `"true"` and then runs `seed.demo`, tagged `// TODO(release): remove dev.reseed`. Add a dev-only `GET /api/dev/seed` that calls it.
   Verify: open `http://localhost:3000/api/dev/seed`, then the dashboard shows the demo items.

## Interfaces delivered

| Convex function | Kind | Test route |
| --- | --- | --- |
| `foods.importReference` | internal mutation | `npx convex run foods:importReference` |
| `seed.demo` (via `dev.reseed`) | internal mutation | `GET /api/dev/seed` |
| `profiles.me` | query | `GET /api/profiles/me` |
| `getUserId(ctx)` | helper in `convex/model/auth.ts` | used by every public function |
| `mergeReferenceFood` | pure function in `lib/referenceMerge.ts` | `npm test` |

Notes for p1-02 and p1-03:

- `getUserId` takes a query or mutation context. An action (such as p1-02's `items.addManual`) gets the user by calling a query or mutation through `ctx.runQuery` or `ctx.runMutation`, which carry the caller's auth.
- Seeded items have `expiresAt` and `purchasedAt` that agree with their food's sourced range (`purchasedAt = expiresAt - range.min`), so `expiryFor` from p1-02 reproduces them.
- The demo user is `demo@freshly.test` with UTC offset -420 and `digestHour` 9. Its whole milk has no `expiresAt`.
- Food names are lowercase. FDA rows use short names ("ground beef", "chicken breast"). FoodKeeper rows use "name, subtitle" ("cheese, hard such as cheddar, swiss, block parmesan"), except a few renamed to what receipts say: "milk", "spinach", "lettuce", "butter", "yogurt". Rows that duplicate an FDA food are merged into it, and the FoodKeeper label becomes an alias.
- No signed-up user gets a `profiles` row yet. Whoever builds the sign-in flow should create it, with the browser's UTC offset.

## Validation

- `npm run dev` starts Next.js and Convex with one command.
- `npm run lint`, `npm run typecheck`, and `npm test` pass.
- `GET /api/health` returns `{"ok":true}`.
- `GET /api/dev/seed` resets the demo fridge, and running it twice gives the same result.
- Every shelf-life range in `foods` has a `source` and a `ref`.
- After `npm run build && npm start`, `GET /api/dev/seed` returns 404.
- `grep -r "TODO(release)"` lists the demo-user fallback and `dev.reseed`.

Result on 2026-10-23: all seven pass. `foods` has 673 rows and 1026 ranges, every one with `source` and `ref`. Two runs of `foods:importReference` both end at 673 rows. Two runs of `/api/dev/seed` each leave 17 demo items (3 expired, 3 at 1, 3, and 7 days, 2 fresh, 1 undated, 8 resolved). `next start` answers 404 on `/api/dev/seed`. With `ALLOW_DEMO_USER` unset, `npx convex run profiles:me` throws "Not signed in"; a Password sign-up through `auth:signIn` returns tokens, and `profiles:me` with that user's identity returns its id. The step 7 check fails for milk (see Surprises).

## Decision log

- 2026-10-23: Use Convex for the whole backend, with no separate API server. `CLAUDE.md` and the product spec already pick Convex, and it covers file storage, scheduled jobs, and external API calls.
- 2026-10-23: Convex Auth with Password, proposed and not yet confirmed by the team. It keeps users in the same database. Clerk is the alternative if social login is wanted.
- 2026-10-23: Browser-testable `/api` routes instead of terminal scripts, at the team's request. A demo-user fallback gated by a dev-only Convex env var makes them work before sign-in exists.
- 2026-10-23: Shelf-life values come only from the FDA chart, FoodKeeper, or the user, per `CLAUDE.md`. FoodKeeper moved from optional to required because without it most grocery items have no sourced value.
- 2026-10-23: Kept Tailwind from the `create-next-app` default, approved by Leo.
- 2026-10-23: Dev runs against a local anonymous Convex deployment (`CONVEX_AGENT_MODE=anonymous`), because the agent that built p1-01 could not log in to Convex. Nothing in the code depends on it. "Running locally" says how to switch to a team project.
- 2026-10-23: Convex Auth runs client-side only: `ConvexAuthProvider` from `@convex-dev/auth/react` inside `app/ConvexClientProvider.tsx`. The Next.js setup puts `ConvexAuthNextjsServerProvider` in the root layout, which reads cookies at the top of the layout. With `cacheComponents` on, that is a build error unless the whole body sits in `<Suspense>`, and the frontend branch is rewriting the layout. Tokens live in localStorage, and there is no `proxy.ts`. Server components and route handlers cannot see the session; the `/api` routes use the demo user instead. Moving to the server provider later is a layout change plus a `proxy.ts`.
- 2026-10-23: Unit conversion for both sources: a week is 7 days, a month 30, a year 365, an hour 1/24 day. "Don't freeze" and blank cells become no range.
- 2026-10-23: The FDA chart is transcribed in `convex/data/fdaChart.script.mjs`, which writes `convex/data/fdaChart.json`. Rows that cover several foods ("Ground turkey, veal, pork, lamb", "Chicken or turkey, parts", "Fresh shrimp, scallops, crawfish, squid") are split into one row per food with the same range and `ref`, so receipt matching can pick a specific name. Aliases such as "salmon" on "fatty fish" are matching hints chosen by the builder, not chart text.
- 2026-10-23: FoodKeeper mapping (`convex/data/foodkeeper.script.mjs`): for each location, use the "from date of purchase" column (`DOP_*`) when it has a metric, else the plain column. A range with no low end is dropped instead of filled in. Non-numeric metrics ("Package use-by date", "When Ripe", "Indefinitely", "Not Recommended") and FoodKeeper's tips go into `storageTip` with `source: "foodkeeper"`. After-opening and after-thawing columns are ignored. Baby food is skipped. `defaultLocation` is the pantry for fruit that ripens there, else the longest sourced storage between pantry and fridge, and the freezer for the "Food Purchased Frozen" category.
- 2026-10-23: `foods.importReference` takes no arguments. It imports the two JSON files bundled into the function, FDA first, through `mergeReferenceFood`: per location the FDA range beats FoodKeeper, which beats nothing, and ties go to the incoming value. Tips rank FDA over FoodKeeper over `llm`. Re-running it changes nothing. `seed.demo` runs it when `foods` is empty.
- 2026-10-23: vitest 5.0.5 and `@types/node` 22.20.5, matching the frontend branch so the lockfiles do not conflict on rebase.

## Surprises

- 2026-10-23: fsis.usda.gov answers `curl` with 403 (Akamai). The FoodKeeper export was read in a browser from `https://www.fsis.usda.gov/shared/data/EN/foodkeeper.json` (file `FMA-Data-v128.xlsx`, data version 128, Last-Modified 2018-09-07, SHA-256 `037df0d301126acd8a48824506f04d49d8be1a1144b81fa69e4170228dc2e91a`), reduced to the columns the mapper uses, and checked by SHA-256 after transfer. To refresh, download that file in a browser and run `node convex/data/foodkeeper.script.mjs <file>`.
- 2026-10-23: FoodKeeper has no numeric fridge range for milk. It says "Package use-by date" (product 27), so the step 7 check fails for milk on purpose: `milk` has only `freezerDays` (3 months) and a tip to follow the package date. Plant milks are the same. Spinach (product 291, 3 - 7 days) and eggs (FDA, 3 - 5 weeks) pass. If the team wants a default milk date, it needs another source added to `CLAUDE.md`.
- 2026-10-23: FoodKeeper product 574 (homemade bread) lists "Refrigerate 2 - 3 Months", which looks like the freezer value in the wrong column. The mapper skips that one range (`SKIP` in `convex/data/foodkeeper.script.mjs`), so homemade bread has only its 3 - 5 day pantry range.
- 2026-10-23: Port 3001 is taken by the frontend branch's dev server; this plan's checks ran on 3002 (`PORT=3002 npm run dev`).

- 2026-10-23: `create-next-app` installed Next.js 16.4 with `cacheComponents` on. With `cacheComponents`, a `GET` handler that reads `req.url` or calls Convex runs per request, so the `/api` routes are not cached. `tsc` alone misses route types, so `npm run typecheck` runs `next typegen` first.
