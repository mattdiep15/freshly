# Exec plans

These plans break `docs/PRODUCT.md` (converted from the team's design doc, now version 2) into work an engineer or coding agent can pick up. Priority 1, 2, and 3 in the spec map to P1, P2, and P3 here. Read `CLAUDE.md` before executing any plan; its rules on code layout, food safety data, demo shortcuts, and git apply to every step.

p1-01 to p1-03 cover the backend only. Each ends with Convex functions the frontend can call, a browser-testable `/api` route for each, and seed data so the UI can be built against realistic state. p1-04 connects the existing screens to those functions.

| Plan | Tier | Covers | Status | Estimate |
| --- | --- | --- | --- | --- |
| [p1-01-backend-foundation.md](p1-01-backend-foundation.md) | P1 | Convex project, vitest, schema, auth, sourced shelf-life data, demo seed | Done; milk has no sourced fridge range (see Surprises) | ~4 h |
| [p1-02-receipt-ingestion.md](p1-02-receipt-ingestion.md) | P1 | Receipt scan, manual entry (P1.5), item matching, expiry dates, storage tips for unfamiliar foods | Done | ~4-5 h |
| [p1-03-expiry-lifecycle-and-waste.md](p1-03-expiry-lifecycle-and-waste.md) | P1 | Use-soon list, reminder digests, push, expiry swipe cards with the "looks spoiled?" second card, waste stats | Done; a real system notification still needs a human check (see Surprises) | ~5-6 h |
| [p1-04-frontend-integration.md](p1-04-frontend-integration.md) | P1 | Home, fridge, swipe cards, scan, manual add, and stats pages wired to Convex | Done; package-date highlights and freshness hints need `foods:backfillTips` on the deployment | ~7-8 h |
| [p1-05-sponsor-tracks.md](p1-05-sponsor-tracks.md) | P1 | Hackathon sponsor tracks: Gemini receipt check, web shelf-life lookup (Apify + Gemini), GoDaddy domain | A and B done (Claude parses, Gemini verifies; web shelf life); D not started; recipes (C) moved to p3 | ~8-10 h |
| [p2-01-schema.md](p2-01-schema.md) | P2 | Tables for the grocery list, friends, and cached recipes; invite codes on profiles | Not started | ~30 min |
| [p2-02-grocery-list.md](p2-02-grocery-list.md) | P2 | Grocery list, checked off by hand or by a scanned receipt | Not started | ~2-3 h |
| [p2-03-community-and-streaks.md](p2-03-community-and-streaks.md) | P2 | Friends by invite code, weekly leaderboard and streak on the `/community` page (friends and my numbers views) | Done for the demo user and seeded friends; friends between real accounts wait on sign-in | ~4-5 h |
| [p2-04-recipe-suggestions.md](p2-04-recipe-suggestions.md) | P2 | Recipes for use-soon items from web pages (Apify + Gemini), fixed recipes as fallback | Done; checked end to end on team dev (a run takes about 98 s) | ~3-4 h |
| [p3-integrations.md](p3-integrations.md) | P3 | Store and farmers market connections, food recall alerts, speech, Wrapped Waste, image-based spoilage model; grocery hints, estimated prices, location reminders, and takeout leftovers moved from P2 | Draft | not estimated |

p1-02 and p1-03 both depend on p1-01 and can run in parallel after it lands. p1-01 defines the whole P1 schema up front so the two do not edit `convex/schema.ts` at the same time. p1-04 depends on all three.

P2 follows the screens the designer is drawing: community (stats and friends tabs), grocery list, and recipes. Merge the v5 frontend branch (`claude/frontend-prototype-v5-19a533`) first, since p2-03 and p2-04 build on its tabs. p2-01 then adds every P2 table in one change, and p2-02, p2-03, and p2-04 can run in parallel after it. If one person builds all of P2, skip p2-01 and add each table in its own plan. Real sign-in is a prerequisite for friends between real accounts (see p2-03), but not for the demo, which uses the demo user and seeded friends.

"Clean, demo-ready UI" is a P1 goal in the spec. p1-04 covers it for every page except friends, which waits for P2.

## Open questions for the team

1. Auth provider. p1-01 proposes Convex Auth with email and password. Clerk is the main alternative.
2. Anthropic API key. p1-02 uses Claude to read receipts and match lines to foods. Someone needs to own the key.
3. Model-written tips. `CLAUDE.md` bars unsourced shelf-life numbers, and the plans follow that. Storage tips and freshness hints for foods outside the FDA chart and FoodKeeper are written by Claude, stored with `source: "llm"`, and labeled in the UI. Confirm that is acceptable, or drop those tips.
4. Partial waste. The spec's swipe card is binary (used or not used). The backend stores a `fractionWasted` value so the UI can add "half used" later without a migration. Decide whether P1 UI exposes it.
5. Test receipts. `data/` holds real receipts with Costco member numbers and card digits. Decide whether to commit them, redact them, or keep them local.
6. Extending raw meat, poultry, and seafood. Design v2 lets a user keep an expired item 1 to 2 more days if it does not look spoiled. p1-03 caps that at the high end of the sourced range, so the date stays sourced. A look-and-smell check says less about raw meat than about produce, so decide whether those categories get the "1-2 more days" option at all.
7. Spoilage model output. The P3 neural net would predict a shelf life from a photo, and `CLAUDE.md` allows only FDA, FoodKeeper, or user dates. Decide before training whether the model may move a date only within the sourced range, or whether it becomes a source listed in `CLAUDE.md`.
8. Web shelf-life as a source. Answered 2026-10-24: packaged foods with no FDA or FoodKeeper range may take a web range (`source: "web"`) with the page URL and a word-for-word quote; FDA and FoodKeeper always win, and the UI still asks for the printed date. `CLAUDE.md` is updated, and p1-05 part B is built.
9. Gemini replacing Claude. Answered 2026-10-24: Claude stays the main receipt parser, and Gemini reads each receipt's store, date, and total a second time and flags disagreements (p1-05 part A). `LLM_PROVIDER=gemini` still switches the main parser if a paid Gemini key turns up.

## Working on a plan

Each plan is a living document. As you work, check off steps in Progress, record choices in the Decision log, and note anything unexpected under Surprises. A plan is done when its Validation section passes and, per `CLAUDE.md`, the feature works when clicked through in the running app (for backend work, through its `/api` routes).
