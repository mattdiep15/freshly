# Exec plans

These plans break `docs/PRODUCT.md` (converted from the team's design doc, now version 2) into work an engineer or coding agent can pick up. Priority 1, 2, and 3 in the spec map to P1, P2, and P3 here. Read `CLAUDE.md` before executing any plan; its rules on code layout, food safety data, demo shortcuts, and git apply to every step.

p1-01 to p1-03 cover the backend only. Each ends with Convex functions the frontend can call, a browser-testable `/api` route for each, and seed data so the UI can be built against realistic state. p1-04 connects the existing screens to those functions.

| Plan | Tier | Covers | Status | Estimate |
| --- | --- | --- | --- | --- |
| [p1-01-backend-foundation.md](p1-01-backend-foundation.md) | P1 | Convex project, vitest, schema, auth, sourced shelf-life data, demo seed | Done; milk has no sourced fridge range (see Surprises) | ~4 h |
| [p1-02-receipt-ingestion.md](p1-02-receipt-ingestion.md) | P1 | Receipt scan, manual entry (P1.5), item matching, expiry dates, storage tips for unfamiliar foods | Done; freezer-move bug open in `docs/bugs.md` | ~4-5 h |
| [p1-03-expiry-lifecycle-and-waste.md](p1-03-expiry-lifecycle-and-waste.md) | P1 | Use-soon list, reminder digests, push, expiry swipe cards with the "looks spoiled?" second card, waste stats | Done; a real system notification still needs a human check (see Surprises) | ~5-6 h |
| [p1-04-frontend-integration.md](p1-04-frontend-integration.md) | P1 | Home, fridge, swipe cards, scan, manual add, and stats pages wired to Convex | Done; package-date highlights and freshness hints need `foods:backfillTips` on the deployment | ~7-8 h |
| [p2-social-and-shopping.md](p2-social-and-shopping.md) | P2 | Community leaderboard, gamification, grocery list, location reminders, takeout leftovers | Draft | not estimated |
| [p3-integrations.md](p3-integrations.md) | P3 | Store and farmers market connections, recipes, speech, Wrapped Waste, image-based spoilage model | Draft | not estimated |

p1-02 and p1-03 both depend on p1-01 and can run in parallel after it lands. p1-01 defines the whole P1 schema up front so the two do not edit `convex/schema.ts` at the same time. p1-04 depends on all three.

"Clean, demo-ready UI" is a P1 goal in the spec. p1-04 covers it for every page except friends, which waits for P2.

## Open questions for the team

1. Auth provider. p1-01 proposes Convex Auth with email and password. Clerk is the main alternative.
2. Anthropic API key. p1-02 uses Claude to read receipts and match lines to foods. Someone needs to own the key.
3. Model-written tips. `CLAUDE.md` bars unsourced shelf-life numbers, and the plans follow that. Storage tips and freshness hints for foods outside the FDA chart and FoodKeeper are written by Claude, stored with `source: "llm"`, and labeled in the UI. Confirm that is acceptable, or drop those tips.
4. Partial waste. The spec's swipe card is binary (used or not used). The backend stores a `fractionWasted` value so the UI can add "half used" later without a migration. Decide whether P1 UI exposes it.
5. Test receipts. `data/` holds real receipts with Costco member numbers and card digits. Decide whether to commit them, redact them, or keep them local.
6. Extending raw meat, poultry, and seafood. Design v2 lets a user keep an expired item 1 to 2 more days if it does not look spoiled. p1-03 caps that at the high end of the sourced range, so the date stays sourced. A look-and-smell check says less about raw meat than about produce, so decide whether those categories get the "1-2 more days" option at all.
7. Spoilage model output. The P3 neural net would predict a shelf life from a photo, and `CLAUDE.md` allows only FDA, FoodKeeper, or user dates. Decide before training whether the model may move a date only within the sourced range, or whether it becomes a source listed in `CLAUDE.md`.

## Working on a plan

Each plan is a living document. As you work, check off steps in Progress, record choices in the Decision log, and note anything unexpected under Surprises. A plan is done when its Validation section passes and, per `CLAUDE.md`, the feature works when clicked through in the running app (for backend work, through its `/api` routes).
