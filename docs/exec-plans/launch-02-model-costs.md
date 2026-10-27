# Launch-02: Model costs and the Gemini free tier

Tier: Launch. Estimate: 2 to 3 hours for one engineer. Overview: [launch-00-free-tier-overview.md](launch-00-free-tier-overview.md).

## Purpose

Receipt parsing runs on Claude Sonnet 5.5, which is the largest cost per user. Anthropic has no free API tier, but Claude Haiku 5.5 costs a twentieth as much per token. Gemini's free tier is fine for public web pages, but its terms let Google use what we send, and the receipt header check sends receipt images that show card digits and member numbers. This plan moves receipts to Haiku, keeps free Gemini for web text only, and logs token use so the cost estimates in launch-00 can be replaced with measured ones.

## Context

State on 2026-10-26:

- `convex/model/claude.ts` reads the model from `RECEIPT_MODEL` (default `claude-sonnet-5-5`) and sends `betas: ["server-side-fallback-2026-07-01"]` with `fallbacks: "default"`. Server-side refusal fallback does not exist for Haiku 5.5, so that request field has to go when the model is Haiku.
- Claude is called for the receipt parse (`receiptsNode.parse`), manual entry with no exact food match (`receiptsNode.addManual`), `foods:backfillTips`, and every Gemini call that fails.
- Gemini is called for recipe extraction (`recipesWeb.suggest`), web shelf-life extraction (`shelfLifeWeb.lookupNext`), and the receipt header check (`receiptsNode.verify`, which sends the receipt image).
- In the 2026-10-24 backfill the free Gemini daily quota ran out, and `askGemini` now falls straight back to Claude on a daily-quota 429. With Sonnet that fallback was expensive; with Haiku it costs about $0.003 per call (25,000 tokens of page text).
- Prices (Anthropic model table, 2026-10-06): Haiku 5.5 is $0.10 input and $0.50 output per million tokens for prompts up to 100K tokens; Sonnet 5.5 is $2 and $10.
- Estimate per receipt: about 7,000 input tokens (image, system prompt, and the food-name list from `receipts.parseInput`) and about 3,000 output tokens with thinking. That is about $0.002 on Haiku and $0.045 on Sonnet. Step 1 measures the real numbers.

## Steps

1. Log usage. In `askClaude`, log `response.usage` (input, output, cache read) with the model and the caller's label, and do the same for Gemini's `usageMetadata`. Convex logs are enough; no table.
   Verify: `npx convex logs` shows token counts after one receipt parse on dev.
2. Make the fallback field depend on the model. Send `betas` and `fallbacks` only when the model is not a Haiku model. Haiku 5.5 runs adaptive thinking by default at effort `medium`; set `output_config.effort: "low"` for extraction calls and check the parse quality before raising it.
   Verify: a parse with `RECEIPT_MODEL=claude-haiku-5-5` on dev succeeds, and the same request with Sonnet still sends the fallback.
3. Compare Haiku with Sonnet on the three receipts in `web/data/` and the fixtures in `convex/data/receipt-fixtures`. Check line count, food matches, prices, and the store, date, and total. Write the result in the Decision log.
   Verify: Haiku matches Sonnet on every line of all three receipts, or the differences are listed.
4. Switch. `npx convex env set RECEIPT_MODEL claude-haiku-5-5` on dev, then prod after a week of use. No code change is needed for the switch, since the env var already exists.
5. Receipt header check. Stop sending receipt images to free-tier Gemini. Pick one:
   - a. A second Haiku call that reads only the header at effort `low`, about $0.0005 a receipt. Same vendor as the parse, so it is less independent than Gemini, but it still catches misread totals and dates.
   - b. Turn on Gemini billing for the project and keep the check as it is. Paid Gemini usage is not used to improve Google's products.
   - c. Drop the model check and keep the arithmetic: compare the sum of line prices with the parsed total in `lib/receiptCheck.ts`.
   We recommend (a) until someone wants to pay for Gemini.
   Verify: `receiptsNode.verify` sends no request to `generativelanguage.googleapis.com` (check `npx convex logs`).
6. Per-user cap. Limit receipt parses to 10 per user per day in `receipts.create`, counted from the `by_user` index. The client shows the limit as an error. This bounds what one account, or one script, can spend.
   Verify: the 11th upload in a day fails with the limit message and schedules no parse.

## Validation

- A week of dev use shows Claude cost per receipt within 2x of the $0.002 estimate in the logs.
- No receipt image reaches Gemini's free tier.
- The Anthropic Console has a monthly spend limit set (launch-00 step 1).

## Open questions

1. Is a second check from the same vendor (option a) worth keeping, or is the arithmetic check enough?
2. Should `LLM_PROVIDER=gemini` stay as a switch? With Haiku this cheap, the reason for it (a paid Gemini key) is gone.

## Decision log

- 2026-10-26: Proposed Haiku 5.5 for all Claude calls and free Gemini for public web text only.
