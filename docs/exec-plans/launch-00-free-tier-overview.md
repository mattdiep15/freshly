# Launch-00: Running Freshly for real users on free tiers

Tier: Launch (after the Cal Hacks 13.0 submission). Written 2026-10-26. This is the overview; launch-01 to launch-04 hold the steps.

## Purpose

The hackathon build runs on six outside services, and two of them bill per use. Before real users sign up, we need to know which services can stay, what each one costs at small scale, and what has to change so a few hundred students cost us close to nothing. Accounts also have to replace the shared demo user.

## Summary

| Service | Free tier (checked 2026-10-26) | What Freshly uses | Verdict |
| --- | --- | --- | --- |
| Convex | 1M function calls, 0.5 GB database, 1 GB database I/O, 1 GB files, 1 GB file egress, 20 GB-hours of action compute per month; up to 6 developers; hard caps | Database, functions, scheduler, crons, auth, receipt files | Keep. No database swap. Fix the full-table `foods` scans first (launch-04), since database I/O is the cap we hit first. |
| Convex Auth | Free library, already installed | `Password` provider wired, no sign-in UI | Keep. Add Google sign-in and email codes (launch-01). |
| Anthropic (Claude) | No free API tier. Haiku 5.5 is $0.10 / $0.50 per million input / output tokens; Sonnet 5.5 is $2 / $10 | Receipt parse on Sonnet 5.5, tips, every Gemini fallback | Keep, switch to Haiku 5.5. About 20 times cheaper per receipt by our estimate (launch-02). |
| Gemini | Free tier with per-project daily quotas shown in AI Studio. Google's free-tier terms let it use prompts to improve its products. | Recipe and shelf-life extraction from public pages, receipt header check | Keep the free tier for public web text. Stop sending receipt images to it (launch-02). |
| Apify | $5 of usage per month, 5 concurrent runs | `rag-web-browser` for recipes and StillTasty lookups, about $0.007 per search | Keep, within a daily budget. Snapshot the StillTasty results and share recipes across users (launch-03). |
| Vercel | Hobby plan is free and limited to non-commercial use | Next.js hosting | Keep while Freshly earns nothing. Referral fees or sponsored listings (the Devpost marketplace idea) need the Pro plan. |
| Web Push | Free (browser push services) | Daily digest | No change. p2-05 covers prod keys and opt-in. |
| Resend (new) | 3,000 emails per month, 100 per day | Not used yet | Add for sign-in codes (launch-01). |
| Domain | Paid registration | freshly.cooking (Devpost link) | Check the yearly renewal price, since some TLDs renew higher than the first year. |

The database does not have to move off Convex. Convex's free plan covers the data, and replacing it would mean rewriting all of `convex/` (about 2,300 lines), every `useQuery` call, the scheduler chains, the hourly cron, and auth. Convex's free plan has no overage billing: once a cap is reached, writes can fail until the next month. So we need to watch the Usage page and keep the expensive reads small, which is what launch-04 does.

## Rough monthly cost at 100 weekly active users

These are estimates to check against real usage once launch-02 logs token counts. Assumptions: each user scans 2 receipts a week, adds 3 items by hand, and opens recipes 4 days a week.

| Item | Today's setup | After launch-02 to launch-04 |
| --- | --- | --- |
| Receipt parsing (800 a month) | Sonnet 5.5, about $0.045 each: $36 | Haiku 5.5, about $0.002 each: under $2 |
| Recipe searches (1,600 a month) | Apify $0.007 each: $11, over the $5 free credit | Shared recipe table plus a 20-run daily cap: $0 to $4.20 |
| Shelf-life lookups | $4.50 per full backfill on each new deployment | Committed snapshot; only new packaged foods: under $0.50 |
| Recipe and shelf-life extraction | Free Gemini, Claude Sonnet when the quota runs out | Free Gemini, Claude Haiku as fallback: under $1 |
| Convex, Vercel, Resend, Web Push | $0 | $0 |

Total after the changes: about $0 to $5 a month plus the domain, compared with about $50 a month on the current setup.

## Order of work

1. Spend guards today, about 30 minutes. The prod deployment has `ALLOW_DEMO_USER=true` (see `docs/PROD-RUNBOOK.md`), so anyone who opens https://freshlyyy.vercel.app can scan receipts on our Anthropic key and run Apify searches. Set a monthly spend limit in the Anthropic Console, set a monthly usage limit in Apify billing settings, and decide whether prod keeps the demo user until launch-01 ships.
2. [launch-02-model-costs.md](launch-02-model-costs.md): Haiku 5.5 and Gemini privacy, 2 to 3 hours.
3. [launch-04-convex-free-plan-fit.md](launch-04-convex-free-plan-fit.md): `foods` reads and receipt file cleanup, 3 to 4 hours.
4. [launch-03-web-lookups.md](launch-03-web-lookups.md): StillTasty snapshot, shared recipes, daily Apify budget, 4 to 6 hours.
5. [launch-01-accounts-and-auth.md](launch-01-accounts-and-auth.md): sign-in, profiles, account deletion, demo user off, 1.5 to 2 days.
6. [p2-05-push-for-real-users.md](p2-05-push-for-real-users.md): already written, 3 to 4 hours, and step 2 waits on launch-01.
7. Launch check: `grep -r "TODO(release)" web` lists nothing, and `ALLOW_DEMO_USER` is unset on prod.

Steps 2, 3, and 4 touch different files and can run in parallel. launch-01 is the largest piece and blocks real friends (p2-03) and per-user push (p2-05). The Devpost "What's next" features (local shops, location nudges, Ask Leeky, Waste Wrapped, the freshness model, speech) start after step 7.

## Open questions for the team

1. Does prod keep a public demo until sign-in ships? Today every visitor shares one account's fridge, and every visitor can spend on our keys.
2. Which Convex plan is the `matthew-lu-diep` team on? If a hackathon credit or trial put it on a paid plan, check what happens when it ends.
3. Who owns the Anthropic, Google, and Apify accounts after the hackathon, and whose card is on file?
4. Does the Gemini receipt header check stay? launch-02 lists the options.

## Sources

- Convex limits: https://docs.convex.dev/production/state/limits
- Apify pricing: https://apify.com/pricing
- Gemini rate limits: https://ai.google.dev/gemini-api/docs/rate-limits (free-tier numbers are per project in AI Studio)
- Gemini free-tier data terms, as quoted in 2024: https://simonwillison.net/2024/Oct/17/gemini-terms-of-service
- Vercel Hobby plan: https://vercel.com/docs/plans/hobby and https://vercel.com/docs/limits/fair-use-guidelines
- Resend quotas: https://resend.com/docs/knowledge-base/account-quotas-and-limits
- Claude prices: the Anthropic model table as of 2026-10-06
- Devpost write-up: https://devpost.com/software/freshly-m8zl9k

## Decision log

- 2026-10-26: Keep Convex. The free plan covers a few hundred users once the `foods` scans are fixed, and moving off it is a backend rewrite.
