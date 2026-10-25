# Architecture

How Freshly's services connect and which functions each workflow runs through. Paths are relative to `web/`. For how each service works in general (Convex deployments and function kinds, Apify Actors and billing, MCP), see [sponsor-tools.md](sponsor-tools.md).

## How the pieces connect

```
Vercel --pages and JS--> Browser <==WebSocket: useQuery / useMutation / useAction==> Convex
(Next.js, app/)                                                    (database, functions,
                                                                    scheduler, crons, auth)
                                                                           |
                                                     Convex actions call Apify, Gemini,
                                                     Claude and Web Push
```

Vercel serves the Next.js pages and their JavaScript. After load, the browser talks to Convex directly over the WebSocket that `app/ConvexClientProvider.tsx` opens, so app data never passes through Vercel. The JSON routes under `app/api/` exist to test backend functions in a browser.

Queries read data and can be subscribed to. Mutations are transactions and cannot call the network. Actions can call outside services but reach the database only through `ctx.runQuery` and `ctx.runMutation`, so every outside call in Freshly is in an action. A mutation starts an action with `ctx.scheduler.runAfter(0, ...)`, which is written in the same transaction, so a failed mutation schedules nothing. Scheduled actions run at most once and are not retried. When a mutation writes a document that a subscribed query read, Convex reruns the query and pushes the new result, so pages update without polling.

## Receipt upload, parse, and Gemini header check

```
Browser ScanFlow (app/_components/ScanFlow.tsx)
  | receipts.generateUploadUrl, POST the file to that URL, then receipts.create
  v
receipts.create (mutation)              insert receipts row, status "uploaded"
  | runAfter(0, internal.receiptsNode.parse)
  v
receiptsNode.parse (Node action)        status "parsing", read the file from Convex storage
  | askJson (model/llm.ts): Claude, or Gemini when LLM_PROVIDER=gemini
  v
receipts.saveParsed (mutation)          insert draft items with sourced expiry, status "parsed"
  | scheduleWebLookup(foodIds) -------> web shelf-life lookup
  | if isReceipt: runAfter(0, internal.receiptsNode.verify)
  v
receiptsNode.verify (Node action)       askGemini reads only store, date and total
  v
receipts.saveVerification (mutation)    mismatches become reviewFlags; no date changes
  v
Browser useQuery(api.receipts.get) shows drafts and flags
  | receipts.confirmDrafts: drafts become active items
  | requestSuggestion({ preload: true }) -------> recipe suggestions
```

A parse error sets the receipt to "failed" with the message. A failed header check saves `verification.status: "skipped"` and keeps the parse. Manual entry (`ManualEntryCard`) calls the public action `receiptsNode.addManual`, which asks the model only when the name has no exact food match; `itemEdits.insertManual` then starts the same web lookup and recipe preload.

## Recipe suggestions

```
Browser /recipes (app/recipes/page.tsx) on open
  | useMutation(api.recipes.request)    confirmDrafts and insertManual preload it too
  v
recipes.requestSuggestion               up to 3 use-soon foods; reuses today's row if the set
  |                                     is unchanged; 3 runs a day; off when hideWebRecipes
  | insert recipeSuggestions row, status "pending"
  | runAfter(0, internal.recipesWeb.suggest)
  v
recipesWeb.suggest (action)
  | searchPages("recipe <ingredients>") in model/apify.ts
  |   POST apify~rag-web-browser run-sync-get-dataset-items, Bearer APIFY_TOKEN
  |   top 5 results as markdown, each cut to 20,000 characters
  | askGemini with RECIPE_SCHEMA; askClaude if Gemini throws
  | groundedRecipes (lib/recipeWeb.ts) drops recipes whose URL was not fetched
  v
recipes.save (mutation)                 row "ready" with recipes, or "failed" with the error
  v
Browser useQuery(api.recipes.today) re-renders
```

## Web shelf-life lookup

```
receipts.saveParsed or itemEdits.insertManual
  | scheduleWebLookup (shelfLifeWeb.ts): if any food needsWebLookup,
  | runAfter(0, internal.shelfLifeWeb.lookupNext) once
  v
shelfLifeWeb.lookupNext (action)        returns early when APIFY_TOKEN is unset
  | shelfLifeWeb.claimNext (mutation)   set webLookupAt on the next food so no other chain takes it
  | searchPages("<food> site:stilltasty.com", allowedSite)
  | askGemini with WEB_SHELF_LIFE_SCHEMA; askClaude if Gemini throws
  | pickWebRanges, pickWebTips (lib/webShelfLife.ts): keep figures with URL and quote
  v
shelfLifeWeb.saveRanges (mutation)      fill empty ranges (source "web"), date this food's
  |                                     undated draft and active items
shelfLifeWeb.saveTips (mutation)        replace only a missing or model-written tip or hint
  | runAfter(0, internal.shelfLifeWeb.lookupNext) for the next food
  v
chain ends when claimNext finds no food
```

Ranges are looked up only for packaged foods (`hasPrintedDate`) with no FDA or FoodKeeper range. After an error, `shelfLifeWeb.release` clears `webLookupAt` and the chain stops, so a later chain retries that food. `npx convex run shelfLifeWeb:lookupNext` backfills existing foods.

## foods:backfillTips

```
npx convex run foods:backfillTips       once after foods:importReference (setup:convex offers it)
  v
foods.backfillTips (internal action)
  | foods.missingTips (query): foods missing storageTip, freshnessHint or hasPrintedDate
  | first 25, numbered so the model never copies names back
  | askJson with TIPS_SCHEMA: Claude, or Gemini when LLM_PROVIDER=gemini
  v
foods.saveTips (mutation)               fill only empty fields, source "llm"
  | if it filled something and foods are still missing:
  |   runAfter(0, internal.foods.backfillTips)    a new run with its own time limit
  v
stops when nothing is missing or a batch fills nothing
```

It is an internal action so the browser cannot trigger the model spend.

## Hourly lifecycle tick and push

```
crons.ts: crons.hourly("lifecycle tick", { minuteUTC: 0 }, internal.lifecycle.tick)
  v
lifecycle.tick (internal mutation) -> runLifecycleTick
  | active items with expiresAt <= now become "expired" (review swipe cards)
  | each profile whose local digestHour is now and with no notification today:
  |   buildDigest (lib/digest.ts), insert notifications row
  |   runAfter(0, internal.pushNode.send, { notificationId })
  v
pushNode.send (Node action)
  | push.deliveryFor (query): the notification and the user's subscriptions
  | web-push sendNotification, signed with VAPID_* keys
  | push.deleteByEndpoints removes subscriptions the push service reports gone
  v
public/sw.js shows the notification
```

Subscriptions come from `PushSubscribeButton`, which needs `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.

## Outside services and their env vars

| Service | Used for | Env vars | Set on |
| --- | --- | --- | --- |
| Convex | Database, functions, scheduler, crons | `NEXT_PUBLIC_CONVEX_URL` | Vercel (`web/.env.local` locally) |
| Convex CLI | Which deployment `convex dev` pushes to | `CONVEX_DEPLOYMENT` | `web/.env.local` only |
| Convex Auth | Sign-in | `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL` | Convex deployment |
| Claude | Receipt parse, tips, Gemini fallback | `ANTHROPIC_API_KEY`, `RECEIPT_MODEL`, `LLM_PROVIDER` | Convex deployment |
| Gemini | Recipe and shelf-life extraction, header check | `GEMINI_API_KEY`, `GEMINI_MODEL` | Convex deployment |
| Apify | Web search for recipes and shelf life | `APIFY_TOKEN` | Convex deployment |
| Web Push | Digest notifications | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Convex deployment |
| Web Push | Browser subscription | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Vercel (`web/.env.local` locally) |
| GoDaddy | Domain, not set up yet | `SITE_URL` once the domain exists | Convex prod deployment |

Dev and prod Convex deployments keep separate env vars, and `npm run setup:convex` sets the Convex ones. `ALLOW_DEMO_USER=true` goes on dev only. Model defaults are `claude-sonnet-5-5` for `RECEIPT_MODEL` and `gemini-3.8-flash` for `GEMINI_MODEL`. Without `GEMINI_API_KEY`, every Gemini call falls back to Claude and the header check is skipped.
