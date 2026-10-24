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
}  index by_user_status [userId, status], index by_status_expires [status, expiresAt]

foodFamiliarity: { userId, foodId, timesAdded: number, tipViews: number }
  index by_user_food [userId, foodId]

pushSubscriptions: { userId, endpoint: string, p256dh: string, auth: string }
  index by_user [userId]

notifications: {
  userId, kind: "digest", dateKey: string,  // "2026-10-24" in the user's local time
  title: string, body: string, itemIds: Id<"items">[], readAt?: number,
}  index by_user_date [userId, dateKey]
```

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

## Progress

- [x] 1. Scaffold Next.js at the repo root (2026-10-23: Next.js 16.4, Tailwind 4, `/api/health` live, `npm run typecheck` added)
- [ ] 2. Add Convex and a combined dev script
- [ ] 3. Add vitest and `npm test`
- [ ] 4. Add auth and `getUserId`
- [ ] 5. Write `convex/schema.ts`
- [ ] 6. Load the FDA chart into `foods`
- [ ] 7. Import USDA FoodKeeper into `foods`
- [ ] 8. Add the demo seed and its `/api` route

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
| `getUserId(ctx)` | helper in `convex/model/auth.ts` | used by every public function |

## Validation

- `npm run dev` starts Next.js and Convex with one command.
- `npm run lint`, `npm run typecheck`, and `npm test` pass.
- `GET /api/health` returns `{"ok":true}`.
- `GET /api/dev/seed` resets the demo fridge, and running it twice gives the same result.
- Every shelf-life range in `foods` has a `source` and a `ref`.
- After `npm run build && npm start`, `GET /api/dev/seed` returns 404.
- `grep -r "TODO(release)"` lists the demo-user fallback and `dev.reseed`.

## Decision log

- 2026-10-23: Use Convex for the whole backend, with no separate API server. `CLAUDE.md` and the product spec already pick Convex, and it covers file storage, scheduled jobs, and external API calls.
- 2026-10-23: Convex Auth with Password, proposed and not yet confirmed by the team. It keeps users in the same database. Clerk is the alternative if social login is wanted.
- 2026-10-23: Browser-testable `/api` routes instead of terminal scripts, at the team's request. A demo-user fallback gated by a dev-only Convex env var makes them work before sign-in exists.
- 2026-10-23: Shelf-life values come only from the FDA chart, FoodKeeper, or the user, per `CLAUDE.md`. FoodKeeper moved from optional to required because without it most grocery items have no sourced value.
- 2026-10-23: Kept Tailwind from the `create-next-app` default, approved by Leo.

## Surprises

- 2026-10-23: `create-next-app` installed Next.js 16.4 with `cacheComponents` on. With `cacheComponents`, a `GET` handler that reads `req.url` or calls Convex runs per request, so the `/api` routes are not cached. `tsc` alone misses route types, so `npm run typecheck` runs `next typegen` first.
