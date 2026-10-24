# CLAUDE.md

## Freshly

Web app that tracks what's in a student's fridge, estimates when each item expires, and
reminds them to use it before it goes bad. Product scope and priorities: `docs/PRODUCT.md`.

Two-person team (Leo, Matthew). We are building for a hackathon demo and plan to ship to
real users after, so code has to survive past the demo.

### Stack and commands

Next.js (App Router) + TypeScript on Vercel. Convex for the database, server functions,
and scheduled jobs.

Run every command from `web/`, which holds all app code and its config.

```bash
cd web
npm run dev        # Next.js and `convex dev` together (concurrently)
npm run lint
npm run typecheck  # next typegen && tsc --noEmit
npm test           # vitest run
```

Run lint and typecheck before every commit. Backend functions are testable in the browser through JSON routes under
`web/app/api/` (see `docs/exec-plans/p1-01-backend-foundation.md`).

### Testing against the team dev deployment

The main checkout's `web/.env.local` points at Leo's Convex dev deployment in the team project
(`dev:secret-opossum-432`, shown as `dev/leo-huang`), which has the Anthropic key, the auth keys, and `ALLOW_DEMO_USER`
set. A worktree's local anonymous deployment has none of them, so receipt parsing fails there.
To test a branch end to end before merging, copy that `.env.local` into the worktree's `web/`
and run `npm run dev` from `web/`.

`convex dev` pushes the branch's functions and schema to that deployment and replaces what
was there, so run it from one checkout at a time. When you finish, put main's functions back:
in the worktree, `git checkout origin/main -- web/convex`, run `npx convex dev --once`, then
`git checkout HEAD -- web/convex`. Pushing from the main checkout also works if its
`node_modules` is current. `/api/dev/seed` (also `/api/dev/reset-db`, or `npm run reset` without
Next running) resets the demo user's items and receipts for everyone using the deployment; it
keeps the demo settings. Never copy a production env.

### Setting up a Convex deployment

`npm run setup:convex` (from `web/`) prepares a new deployment with prompts. It targets the
deployment in `web/.env.local` or the project's prod deployment, and prod needs a typed "yes".
It generates the Convex Auth keys, sets `SITE_URL`, the API keys (input is hidden, Enter
skips), VAPID keys, and optional model overrides, sets `ALLOW_DEMO_USER=true` on dev only,
and offers to push functions, load data, and run `foods:backfillTips`. With no `.env.local`,
run `npx convex dev --once` first.

### Where code goes

The root holds only `web/` (everything that runs: code, config, `package.json`), `docs/`,
`dev/` (design prototypes), and Markdown files. There is no `infra/`: Vercel and Convex
are managed. Vercel's Root Directory setting is `web`. Paths below are inside `web/`.

- `convex/schema.ts`: the only source of truth for data shape.
- `convex/*.ts`: every read and write. Validate args with `v.*` and check the signed-in
  user in every public function. Outside services (receipt OCR, product lookup, push) go
  in Convex actions.
- `lib/`: pure domain logic shared by the frontend and Convex (expiry math, reminder
  schedule, waste stats). No React or Convex imports, so it can be unit tested.
- `app/`: all frontend code. Routes compose components and call Convex hooks. No business
  logic in pages.
- `app/_components/`: React components; `app/_components/ui/` holds shared primitives.
  Search there before creating a component. Components fill their slot; the page owns
  layout. Folders starting with `_` are not routed.
- `public/`: static files (Next.js requires this name).

Secrets live in Convex or Vercel env vars. Never put a key in a `NEXT_PUBLIC_` var.

### Demo shortcuts

Shortcuts are fine when they are marked. Tag each one `// TODO(release): <what to fix>`
so `grep -r "TODO(release)"` lists the cleanup before launch. Fake data goes in
`convex/seed.ts`, never hardcoded in components.

### Food safety data

Shelf-life numbers are safety claims. Take them from `docs/food_storage_chart.pdf` (FDA,
2018), its newer edition `docs/cold_food_storage_chart_2023.md` (foodsafety.gov, reviewed
2023-09-19), or USDA FoodKeeper, and store the source next to each value. If an item has no sourced
value, the UI says so instead of guessing.

The one exception is packaged foods (`hasPrintedDate`) with no FDA or FoodKeeper range:
they may take a web range (`source: "web"`) from an allowlisted page, stored with the page
URL and a sentence quoted word for word from it. FDA and FoodKeeper ranges always win, and
the UI still asks for the printed date.

### Code style

- TypeScript strict. No `any` without a one-line reason.
- Comments are one short line explaining why. No multi-line blocks or long docstrings.
- Don't add a UI, styling, or state library without asking.

### Git

- Work on a feature branch. Commit at each working checkpoint.
- Never push, open a PR, or merge into `main` without asking, even when tests pass.
- `main` deploys to Vercel and must always build.
- PRs are squash-merged into `main`. Keep history linear and never create merge commits.
- Commit messages and PR titles are one imperative line, 72 characters max, with no body.
  Start with a type prefix: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, or `test:`.

### Definition of done

Lint and typecheck pass. The feature works when you click through it in the running app,
not only in tests. New logic in `lib/` has a test.

---

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
