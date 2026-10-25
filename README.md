# freshly

## Run locally

All app code and its config live in `web/`. Run commands from there:

```bash
cd web
npm install
npm run dev
```

Env vars: copy `web/.env.example` to `web/.env.local`, or let the first `npx convex dev` write it.

Open http://localhost:3000. Backend functions are testable from the browser through JSON routes under `/api`, starting with http://localhost:3000/api/health.

## Set up a Convex deployment

Run `npm run setup:convex` from `web/` once per new deployment. It sets the auth keys and API keys, pushes functions, and loads the reference foods. Its last two prompts default to no because they cost money. Answer yes on a deployment you will demo, or run them later from `web/`:

```bash
npx convex run foods:backfillTips
npx convex run shelfLifeWeb:lookupNext
```

`foods:backfillTips` has the model write a storage tip, a freshness hint, and a printed-date flag for every food that lacks one, 25 foods per batch, in a few minutes. `shelfLifeWeb:lookupNext` searches StillTasty through Apify one food at a time and replaces model-written tips and hints with sourced ones. It runs for hours, and each extra call starts another chain in parallel. Neither command needs `npm run dev` running. Follow either with `npx convex logs`.

Plans for the backend and later features are in [docs/exec-plans](docs/exec-plans/README.md).
