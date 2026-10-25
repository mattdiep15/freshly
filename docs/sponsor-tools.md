# How the sponsor tools work

A learning guide to the services Freshly is built on: how each one works in general, then how Freshly uses it. The request flows, step by step, are in [ARCHITECTURE.md](ARCHITECTURE.md). Paths are relative to `web/`.

The sponsor tracks come from `docs/design_tracks.pdf` (listed in `docs/exec-plans/p1-05-sponsor-tracks.md:7`): Apify, Gemini, Convex and GoDaddy. Figma, People-First and Planet-First are judging tracks with no code. Anthropic (Claude), Vercel and Web Push are outside services, not sponsors.

In short:

- Convex is the whole backend: database, server functions, scheduler, crons and auth. The browser talks to it directly over a WebSocket.
- Apify runs one Actor, `apify/rag-web-browser`, which does a Google search, fetches the top 5 pages and returns them as markdown. Freshly calls it with a plain `fetch` from a Convex action.
- Gemini reads what Apify fetched (recipes, web shelf life) and reads receipt headers a second time. Claude is the fallback.
- Claude parses receipts and writes the model storage tips and freshness hints.
- GoDaddy will hold the domain (not done). Vercel hosts the Next.js frontend.

## Convex

How it works:

- Deployments. Each project has one prod deployment and one dev deployment per teammate (Leo's is `dev:secret-opossum-432`). A deployment is a database plus the functions and env vars running on it.
- `npx convex dev` watches `convex/`, typechecks, regenerates `_generated/`, and pushes every function and the schema to the dev deployment. The push replaces the whole function set, so anything not in your checkout is gone. The schema push fails if existing data doesn't match. `npx convex deploy` does the same to prod.
- Function kinds. A query is read-only, deterministic, cached and subscribable. A mutation is a read/write transaction, all or nothing, with no network. An action can call outside APIs with `fetch` (or Node libraries with `"use node"`) but has no `ctx.db`; it reads and writes through `ctx.runQuery` and `ctx.runMutation`.
- Public and internal. `query`, `mutation` and `action` are callable from the browser, so each checks the signed-in user (`getUserId`). `internalQuery`, `internalMutation` and `internalAction` are callable only from other functions, the scheduler, crons, the dashboard and `npx convex run`.
- Reactivity. `useQuery` subscribes over the WebSocket. Convex records which documents the query read; when a mutation writes one of them, Convex reruns the query and pushes the new result.

The scheduler, using `foods:backfillTips` (`convex/foods.ts:87`) as the example:

1. It is an `internalAction`, because it calls Claude and users must not be able to trigger that spend.
2. It reads foods missing a tip through `internal.foods.missingTips` (`foods.ts:54`) and takes 25.
3. It calls `askJson` (`foods.ts:98`), which goes to Claude unless `LLM_PROVIDER=gemini` (`convex/model/llm.ts:8`).
4. It saves through `internal.foods.saveTips` (`foods.ts:63`), which fills only empty fields.
5. If it filled something and more are missing, `ctx.scheduler.runAfter(0, internal.foods.backfillTips, {})` (`foods.ts:108`) queues a fresh run. Each run gets its own time limit, and a batch that fills nothing stops the chain.

`runAfter(delay)` and `runAt(time)` write the job inside the current transaction, so a failed mutation schedules nothing. Scheduled mutations run exactly once; scheduled actions run at most once and are not retried. Other chains start at `receipts.ts:67` (parse), `receiptsNode.ts:60` (Gemini header check), `shelfLifeWeb.ts:141` (next lookup) and `lifecycle.ts:56` (push).

Crons are declared in code. `convex/crons.ts:6` runs `internal.lifecycle.tick` hourly at minute 0 UTC to expire items and send digests.

Env vars live in two places. Each Convex deployment has its own, read as `process.env` inside `convex/`, and dev and prod are separate. Next.js reads its own from `web/.env.local` locally or from Vercel, and only public values go there. The full list is in [ARCHITECTURE.md](ARCHITECTURE.md#outside-services-and-their-env-vars).

CLI, run from `web/`:

- `npx convex data <table>`, `npx convex logs` and `npx convex env list` only read.
- `npx convex env set NAME value` changes the deployment.
- `npx convex run foods:backfillTips` runs a real function, with real side effects and API spend.
- `npx convex dev` replaces the deployment's code, as described above.

## Apify

How it works:

- An Actor is a program packaged as a container on Apify's cloud. It takes JSON input and writes output to storage. Apify Store lists public Actors; `apify/rag-web-browser` is Apify's own.
- A run is one execution of an Actor with the memory you pick. Each run gets a default dataset (rows of JSON results), a key-value store and a request queue. Unnamed run storage is deleted after the plan's retention period.
- The API has two styles. The async one starts a run (`POST /v2/acts/{id}/runs`), waits or uses a webhook, then reads `GET /v2/datasets/{id}/items`. The sync one, `run-sync-get-dataset-items`, waits up to 300 seconds and returns the dataset rows in the response, or 408 if the run takes longer. `apify-client` for JS and Python wraps both.
- Billing has two parts. Platform usage is compute units (1 CU is 1 GB of memory for 1 hour, billed per second). Pay-per-event Actors add their own fees: `rag-web-browser` charges per Google search, per fetched page (from $1.33 per 1,000) and per run start. The account also caps total memory across running Actors at 16 GB, which is why Freshly asks for 2 GB per run.

Integrations, connectors and MCP:

- Apify calls its hookups integrations: webhooks, Actor-to-Actor calls, Zapier, Make and n8n, Google Drive and Airtable, AI frameworks (LangChain, Vercel AI SDK, OpenAI Agents SDK), and its MCP server.
- Connector is Claude's word. In Claude, a connector is an MCP server you add. The Apify connector is Apify's MCP server at `https://mcp.apify.com`, signed in with OAuth.
- Through MCP an agent gets tools such as `search-actors`, `fetch-actor-details`, `call-actor` and `get-dataset-items`, and the model decides at runtime which Actor to run. Runs bill to the same Apify account, and `rag-web-browser` is loaded by default.
- Freshly uses none of that. Its code hard-codes one Actor and one endpoint and calls it with `fetch`, so the behavior and the cost of each call are fixed. MCP is a dev-time tool here: `docs/cold_food_storage_chart_2023.md` was fetched through `rag-web-browser` outside the app code.

How Freshly uses it:

1. `searchPages` (`convex/model/apify.ts:9`) POSTs `{ query, maxResults: 5, outputFormats: ["markdown"], scrapingTool: "raw-http" }` to `run-sync-get-dataset-items?memory=2048` (`apify.ts:4`) with `Authorization: Bearer ${APIFY_TOKEN}`. It keeps each page's URL and up to 20,000 characters of markdown.
2. Recipes. Opening `/recipes` calls `recipes.request` (`app/recipes/page.tsx:58`), and adding items preloads it (`receipts.ts:111`, `itemEdits.ts:103`). `requestSuggestion` (`convex/recipes.ts:48`) schedules `recipesWeb.suggest` (`convex/recipesWeb.ts:25`), which searches `recipe <ingredients>` (`recipesWeb.ts:36`), has Gemini extract recipes (`recipesWeb.ts:13`, Claude on failure) and drops any recipe whose URL was not fetched.
3. Web shelf life. After a receipt parse or a manual add, `scheduleWebLookup` (`convex/shelfLifeWeb.ts:24`) starts `lookupNext` (`shelfLifeWeb.ts:119`). It searches `<food> site:stilltasty.com` (`shelfLifeWeb.ts:128`), keeps allowlisted sites only, has Gemini extract figures with exact quotes, and saves ranges and tips as `source: "web"`.
4. Without `APIFY_TOKEN`, recipes save a failed row with that message (`recipesWeb.ts:34`) and the shelf-life lookup logs and skips (`shelfLifeWeb.ts:123`).

## Gemini (sponsor)

Google's model API. Freshly calls the REST `generateContent` endpoint with `fetch` and a JSON schema, so it needs no SDK and runs in Convex's default runtime.

`askGemini` (`convex/model/gemini.ts:16`) retries up to 3 times on 429 and 5xx responses (`gemini.ts:31`). It extracts recipes (`recipesWeb.ts:17`), extracts web shelf life (`shelfLifeWeb.ts:110`) and reads receipt headers in `receiptsNode.verify` (`receiptsNode.ts:77`). It is the main parser only when `LLM_PROVIDER=gemini`.

`GEMINI_API_KEY` is optional; without it, Claude covers every call and the header check is skipped. `GEMINI_MODEL` defaults to `gemini-3.8-flash`.

## GoDaddy (sponsor)

Domain registrar and DNS. There is no code. Part D of `docs/exec-plans/p1-05-sponsor-tracks.md` is not started: buy the domain, add it in Vercel, copy Vercel's DNS records into GoDaddy, and set `SITE_URL` on the prod Convex deployment.

## Anthropic / Claude

Anthropic's model API, called through `@anthropic-ai/sdk` with structured JSON output. `askClaude` (`convex/model/claude.ts:23`) parses receipts (`receiptsNode.ts:53`), writes storage tips and freshness hints (`foods.ts:98`), and is the fallback for every Gemini call. Env vars are `ANTHROPIC_API_KEY`, `RECEIPT_MODEL` (default `claude-sonnet-5-5`) and `LLM_PROVIDER`.

## Vercel

Hosting for the Next.js app. `main` deploys automatically, and the Root Directory setting is `web`. Vercel serves the pages and the JSON test routes under `app/api/`. App data does not flow through it, since the browser connects straight to Convex (`app/ConvexClientProvider.tsx:10`).

## Web Push

Browser push notifications, signed with VAPID keys through the `web-push` library. `pushNode.send` (`convex/pushNode.ts:25`) is scheduled from the hourly tick (`lifecycle.ts:56`) and reads `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` from Convex (`pushNode.ts:14`). The browser subscribes with `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.

## Sources

Apify docs: docs.apify.com/api/v2/act-run-sync-get-dataset-items-post, docs.apify.com/platform/integrations, docs.apify.com/platform/integrations/mcp, docs.apify.com/platform/integrations/claude-desktop, docs.apify.com/platform/actors/running/actors-in-store, docs.apify.com/platform/actors/running/usage-and-resources, docs.apify.com/platform/storage/usage, and apify.com/apify/rag-web-browser.
