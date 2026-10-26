# freshly web app

Everything that runs lives here: the Next.js app (`app/`), the Convex backend (`convex/`), shared domain logic (`lib/`), and the setup script (`scripts/`). Run every command below from this folder. To run the app for the first time, start with [QUICKSTART.md](../QUICKSTART.md).

## Commands

```bash
npm run dev            # Next.js and `convex dev` together
npm run lint
npm run typecheck      # next typegen && tsc --noEmit
npm test               # vitest run
npm run setup:convex   # prepare a Convex deployment, with prompts
npm run reset          # reset the demo user's items and receipts on the dev deployment
```

With `npm run dev` running, backend functions are testable from the browser through JSON routes under `/api`, starting with http://localhost:3000/api/health. The `/api/dev/*` routes return 404 in production builds.

## Set up a Convex deployment

Run `npm run setup:convex` once per new deployment. With no `.env.local` yet, run `npx convex dev --once` first to log in and create a dev deployment.

The script asks whether to target the dev deployment in `.env.local` or the project's prod deployment. Prod needs a typed "yes". It then:

1. Generates the Convex Auth keys and sets `SITE_URL`.
2. Asks for `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, and `APIFY_TOKEN`. Input is hidden and Enter skips. Receipts fail without the Anthropic key; the other two are optional.
3. Generates VAPID keys for push notifications and prints the `NEXT_PUBLIC_VAPID_PUBLIC_KEY` line to add to `.env.local` (dev) or Vercel (prod).
4. Offers model overrides (`RECEIPT_MODEL`, `GEMINI_MODEL`, `LLM_PROVIDER`).
5. Sets `ALLOW_DEMO_USER=true` on dev only, and offers to remove it from prod.
6. Offers to push functions, then load data: `dev:reseed` on dev, `foods:importReference` on prod.
7. Offers the two paid backfills, which default to no.

### Paid backfills

Answer yes to the backfills on a deployment you will demo, or run them later:

```bash
npx convex run foods:backfillTips
npx convex run shelfLifeWeb:lookupNext
```

`foods:backfillTips` has the model write a storage tip, a freshness hint, and a printed-date flag for every food that lacks one, 25 foods per batch, in a few minutes. `shelfLifeWeb:lookupNext` searches StillTasty through Apify one food at a time and replaces model-written tips and hints with sourced ones. It runs for hours, and each extra call starts another chain in parallel. Neither needs `npm run dev` running. Follow either with `npx convex logs`. Add `--prod` to run them on prod.

## Deploy

Vercel builds the Next.js app from `main`, with the project's Root Directory set to `web`. Convex hosts the backend separately, so a Vercel deploy does not push Convex functions.

1. Run `npm run setup:convex` and choose prod. Let it push functions (`npx convex deploy`) and load reference foods.
2. On Vercel, set `NEXT_PUBLIC_CONVEX_URL` to the prod deployment's URL and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` to the key the script printed.
3. After a backend change merges, push it to prod with `npx convex deploy`.

Secrets stay on the Convex deployment. Never put a key in a `NEXT_PUBLIC_` var, and never set `ALLOW_DEMO_USER` on a prod deployment real users sign in to.

The full list of env vars and where each one is set is in [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md#outside-services-and-their-env-vars).

## Runbooks

- [docs/DEMO.md](../docs/DEMO.md): the live demo, run from a laptop through a `cloudflared` tunnel so an iPhone gets push reminders.
- [docs/PROD-RUNBOOK.md](../docs/PROD-RUNBOOK.md): reset demo data, send a reminder push, and run the daily tick on prod.
- [docs/exec-plans](../docs/exec-plans/README.md): plans for the backend and later features.
