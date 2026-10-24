import { v } from "convex/values";
import { daysLeft } from "../lib/digest";
import { needsLabelDate } from "../lib/expiry";
import { extendExpiry, sourcedRange } from "../lib/extension";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { getUserId } from "./model/auth";
import { settingsFor } from "./profiles";
import { itemStatus } from "./schema";

const DAY = 24 * 60 * 60 * 1000;
const TIP_VIEWS_UNTIL_FAMILIAR = 3;

export type ItemView = Doc<"items"> & {
  daysLeft: number | null;
  storageTip: Doc<"foods">["storageTip"] | null;
  freshnessHint: Doc<"foods">["freshnessHint"] | null;
  showTip: boolean;
  checkLabel: boolean;
  packaged: boolean; // sold with a printed date; the UI draws a box when no food art matches
};

// New expiresAt for "1-2 more days", or null when the item has no sourced high end left.
export function extendedExpiry(item: Doc<"items">, food: Doc<"foods"> | null, now: number): number | null {
  if (item.status !== "expired" || item.expirySource === "user" || !item.foodId) return null;
  const range = sourcedRange(food, item.location);
  return range ? extendExpiry({ purchasedAt: item.purchasedAt, range, now }) : null;
}

export async function utcOffsetFor(ctx: QueryCtx, userId: Id<"users">): Promise<number> {
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return profile?.utcOffsetMinutes ?? 0;
}

// Adds days left, the food's tips with their sources, whether to still teach the tip, and whether to ask for the printed date.
export async function toItemViews(ctx: QueryCtx, userId: Id<"users">, items: Doc<"items">[]): Promise<ItemView[]> {
  const now = Date.now();
  const offset = await utcOffsetFor(ctx, userId);
  const foods = new Map<Id<"foods">, { food: Doc<"foods"> | null; tipViews: number }>();
  for (const foodId of new Set(items.flatMap((i) => (i.foodId ? [i.foodId] : [])))) {
    const familiarity = await ctx.db
      .query("foodFamiliarity")
      .withIndex("by_user_food", (q) => q.eq("userId", userId).eq("foodId", foodId))
      .unique();
    foods.set(foodId, { food: await ctx.db.get(foodId), tipViews: familiarity?.tipViews ?? 0 });
  }
  return items.map((item) => {
    const entry = item.foodId ? foods.get(item.foodId) : undefined;
    const storageTip = entry?.food?.storageTip ?? null;
    const freshnessHint = entry?.food?.freshnessHint ?? null;
    return {
      ...item,
      daysLeft: item.expiresAt === undefined ? null : daysLeft(item.expiresAt, now, offset),
      storageTip,
      freshnessHint,
      showTip: (storageTip !== null || freshnessHint !== null) && (entry?.tipViews ?? 0) < TIP_VIEWS_UNTIL_FAMILIAR,
      checkLabel: needsLabelDate(entry?.food ?? null, item.expirySource),
      packaged: entry?.food?.hasPrintedDate === true,
    };
  });
}

export const list = query({
  args: { status: v.optional(itemStatus) },
  handler: async (ctx, { status = "active" }) => {
    const userId = await getUserId(ctx);
    const rows = await ctx.db
      .query("items")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", status))
      .collect();
    // The index sorts undated items first; the list wants them last.
    const sorted = [...rows.filter((i) => i.expiresAt !== undefined), ...rows.filter((i) => i.expiresAt === undefined)];
    return await toItemViews(ctx, userId, sorted);
  },
});

export const get = query({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    const userId = await getUserId(ctx);
    const item = await ctx.db.get(itemId);
    if (!item || item.userId !== userId) return null;
    const [view] = await toItemViews(ctx, userId, [item]);
    return view;
  },
});

export const useSoon = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days = 7 }) => {
    const userId = await getUserId(ctx);
    // Over-fetch by a day, then cut on local calendar days.
    const until = Date.now() + (days + 1) * DAY;
    const rows = await ctx.db
      .query("items")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "active").gte("expiresAt", 0).lte("expiresAt", until),
      )
      .collect();
    const views = await toItemViews(ctx, userId, rows);
    return views.filter((i) => i.daysLeft !== null && i.daysLeft <= days);
  },
});

export const resolve = mutation({
  args: {
    itemId: v.id("items"),
    outcome: v.union(v.literal("used"), v.literal("wasted")),
    fractionWasted: v.optional(v.number()),
  },
  handler: async (ctx, { itemId, outcome, fractionWasted }) => {
    const userId = await getUserId(ctx);
    const item = await ctx.db.get(itemId);
    if (!item || item.userId !== userId) throw new Error("Item not found");
    if (item.status !== "active" && item.status !== "expired") {
      throw new Error(`Item is ${item.status}; only active or expired items can be resolved`);
    }
    if (fractionWasted !== undefined && !(fractionWasted >= 0 && fractionWasted <= 1)) {
      throw new Error("fractionWasted must be between 0 and 1");
    }
    const patch = {
      status: outcome,
      fractionWasted: fractionWasted ?? (outcome === "used" ? 0 : (await settingsFor(ctx, userId)).wastedFraction),
      resolvedAt: Date.now(),
    };
    await ctx.db.patch(itemId, patch);
    return { itemId, ...patch };
  },
});

// Second swipe card, "no, 1-2 more days": back to active with a later, still-sourced date.
export const extend = mutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    const userId = await getUserId(ctx);
    const item = await ctx.db.get(itemId);
    if (!item || item.userId !== userId) throw new Error("Item not found");
    if (item.status !== "expired") throw new Error(`Item is ${item.status}; only expired items can be extended`);
    const food = item.foodId ? await ctx.db.get(item.foodId) : null;
    const expiresAt = extendedExpiry(item, food, Date.now());
    if (expiresAt === null) throw new Error("No sourced shelf life left to extend into");
    await ctx.db.patch(itemId, { status: "active", expiresAt });
    return { itemId, status: "active" as const, expiresAt };
  },
});
