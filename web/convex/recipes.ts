import { v } from "convex/values";
import { daysLeft, localDateKey } from "../lib/digest";
import { USE_SOON_DAYS } from "../lib/freshness";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { utcOffsetFor } from "./items";
import { getUserId } from "./model/auth";
import { recipe } from "./schema";

// Each run is an Apify search plus a model call, so a fridge that keeps changing stops after this many a day.
const MAX_RUNS_PER_DAY = 3;
const MAX_INGREDIENTS = 3;

function view({ _id, dateKey, ingredients, status, recipes, error }: Doc<"recipeSuggestions">) {
  return { _id, dateKey, ingredients, status, recipes, error };
}

// Today's rows, newest first; the newest is the one the page shows.
async function todaysRows(ctx: QueryCtx, userId: Id<"users">, dateKey: string) {
  return await ctx.db
    .query("recipeSuggestions")
    .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("dateKey", dateKey))
    .order("desc")
    .collect();
}

// Food names ("chicken breast", not "KS CHKN BRST") of the soonest-expiring active items.
async function soonestIngredients(ctx: QueryCtx, userId: Id<"users">, now: number, offset: number) {
  const items = await ctx.db
    .query("items")
    .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active").gt("expiresAt", now))
    .collect();
  const names: string[] = [];
  for (const item of items) {
    if (names.length === MAX_INGREDIENTS || daysLeft(item.expiresAt ?? now, now, offset) > USE_SOON_DAYS) break;
    const food = item.foodId ? await ctx.db.get(item.foodId) : null;
    const name = (food?.name ?? item.name).toLowerCase();
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

// Called when the recipes page opens; starts a web search only when today's use-soon ingredients changed.
export const request = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    const now = Date.now();
    const offset = await utcOffsetFor(ctx, userId);
    const ingredients = await soonestIngredients(ctx, userId, now, offset);
    if (ingredients.length === 0) return null;
    const dateKey = localDateKey(now, offset);
    const rows = await todaysRows(ctx, userId, dateKey);
    const latest = rows[0];
    if (latest && latest.status !== "failed" && sameSet(latest.ingredients, ingredients)) return view(latest);
    if (rows.length >= MAX_RUNS_PER_DAY) return view(latest);
    const row = { userId, dateKey, ingredients, status: "pending" as const, recipes: [] };
    const suggestionId = await ctx.db.insert("recipeSuggestions", row);
    await ctx.scheduler.runAfter(0, internal.recipesWeb.suggest, { suggestionId });
    return { _id: suggestionId, dateKey, ingredients, status: row.status, recipes: row.recipes, error: undefined };
  },
});

export const today = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    const [latest] = await todaysRows(ctx, userId, localDateKey(Date.now(), await utcOffsetFor(ctx, userId)));
    return latest ? view(latest) : null;
  },
});

export const get = internalQuery({
  args: { suggestionId: v.id("recipeSuggestions") },
  handler: async (ctx, { suggestionId }) => await ctx.db.get(suggestionId),
});

export const save = internalMutation({
  args: { suggestionId: v.id("recipeSuggestions"), recipes: v.array(recipe), error: v.optional(v.string()) },
  handler: async (ctx, { suggestionId, recipes, error }) => {
    if (!(await ctx.db.get(suggestionId))) return;
    await ctx.db.patch(suggestionId, error ? { status: "failed", recipes: [], error } : { status: "ready", recipes, error: undefined });
  },
});
