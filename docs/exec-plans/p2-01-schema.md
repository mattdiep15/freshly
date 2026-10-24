# P2-01: Schema for the grocery list, friends, and recipes

Tier: P2. Estimate: about 30 minutes. Depends on the v5 frontend branch (`claude/frontend-prototype-v5-19a533`) being merged, because the recipe shape mirrors `lib/recipes.ts` from that branch. Blocks p2-02, p2-03, and p2-04.

## Purpose

Add every table and field the next three plans need in one change, so p2-02, p2-03, and p2-04 can run in parallel without two people editing `convex/schema.ts`. p1-01 did the same for P1.

This plan is a coordination step and adds no behavior. If one person builds all of P2, skip it and add each table in its own plan.

## Context

- Code paths are relative to `web/`.
- Every new field on an existing table is optional, so rows already on the team dev deployment still validate and no migration is needed.
- The leaderboard and streaks compute on read from `items` (see p2-03), so the `userStats` table proposed in p1-03 is not added. Computing on read is fine while each user has a handful of friends.

## Schema changes

New tables:

```ts
groceryItems: defineTable({
  userId: v.id("users"),
  name: v.string(),
  foodId: v.optional(v.id("foods")), // set when the name matches a food, so a scanned receipt can check it off
  checkedAt: v.optional(v.number()), // absent while unchecked
  checkedBy: v.optional(v.union(v.literal("user"), v.literal("receipt"))),
}).index("by_user", ["userId"]),

// One row per direction, so "my friends" is one index read.
friendships: defineTable({
  userId: v.id("users"),
  friendId: v.id("users"),
})
  .index("by_user", ["userId"])
  .index("by_pair", ["userId", "friendId"]),

recipeSuggestions: defineTable({
  userId: v.id("users"),
  dateKey: v.string(), // local date, like notifications.dateKey
  ingredients: v.array(v.string()), // the use-soon names the search used
  status: v.union(v.literal("pending"), v.literal("ready"), v.literal("failed")),
  recipes: v.array(recipe),
  error: v.optional(v.string()),
}).index("by_user_date", ["userId", "dateKey"]),
```

`recipe` is exported from `convex/schema.ts` beside the other validators. It mirrors the `Recipe` type in `lib/recipes.ts` plus a source link:

```ts
export const recipeStep = v.object({
  phase: v.union(v.literal("prep"), v.literal("cook"), v.literal("serve")),
  text: v.string(),
  timedMinutes: v.optional(v.number()),
  whisk: v.optional(v.boolean()),
});
export const recipe = v.object({
  id: v.string(),
  name: v.string(),
  ingredients: v.array(v.string()),
  minutes: v.number(),
  dish: v.union(v.literal("pot"), v.literal("pan"), v.literal("bowl")),
  cookTool: v.union(v.literal("pot"), v.literal("pan")),
  heat: v.string(),
  servings: v.number(),
  steps: v.array(recipeStep),
  sourceUrl: v.optional(v.string()), // absent for the static fallback recipes
});
```

New field on `profiles`, plus an index:

```ts
inviteCode: v.optional(v.string()), // 6 characters, set the first time the user opens the friends tab
// .index("by_invite_code", ["inviteCode"])
```

## Steps

1. Add the validators, tables, field, and index above to `convex/schema.ts`.
2. Add `sourceUrl?: string` to the `Recipe` type in `lib/recipes.ts`, so a stored recipe fits the type the recipes page already renders.
3. Run `npx convex codegen` and commit `convex/_generated/` with the schema.
   Verify: `npm run lint`, `npm run typecheck`, and `npm test` pass. `npx convex dev --once` against a local deployment accepts the schema. To check it against the team dev deployment, follow "Testing against the team dev deployment" in `CLAUDE.md`, then open `/api/dev/seed` and `/api/stats/summary` to confirm existing rows still load.

## File ownership

This plan owns `convex/schema.ts` and the `Recipe` type in `lib/recipes.ts`. After it merges, p2-02 to p2-04 do not edit `convex/schema.ts`. If one of them needs a change, add it here first. All three regenerate `convex/_generated/api.d.ts`; on a merge conflict there, run `npx convex codegen` instead of hand-merging.

## Progress

- [ ] 1. Schema
- [ ] 2. `Recipe.sourceUrl`
- [ ] 3. Codegen and checks

## Validation

- Lint, typecheck, and tests pass.
- The team dev deployment accepts the schema with its existing data.

## Decision log

- 2026-10-24: No `userStats` table. p2-03 computes the leaderboard and streaks from `items` on read. Add the table if the leaderboard query gets slow.
- 2026-10-24: No `status: "pending" | "accepted"` on `friendships`. Entering someone's invite code is their consent, so both rows are written at once and there is no request to accept.
- 2026-10-24: `groceryItems` stores `checkedAt` instead of a `checked` boolean, so the list can show recently bought items and clear old ones.
- 2026-10-24: Not run as its own step. p2-04 added the `recipeStep` and `recipe` validators, the `recipeSuggestions` table, and `Recipe.sourceUrl`. The v6 design port defines its own grocery table, so `groceryItems`, `friendships`, and `profiles.inviteCode` wait for that port and p2-03.

## Surprises

(none yet)
