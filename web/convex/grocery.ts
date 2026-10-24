import { v } from "convex/values";
import { groceryKey } from "../lib/grocery";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { getUserId } from "./model/auth";
import { groceryEntries, MAX_GROCERY_ROWS } from "./model/grocery";

const DAY = 24 * 60 * 60 * 1000;
const SHOW_CHECKED_DAYS = 7;
const MAX_NAME_LENGTH = 80;

async function ownEntry(ctx: QueryCtx, entryId: Id<"groceryItems">) {
  const userId = await getUserId(ctx);
  const entry = await ctx.db.get(entryId);
  if (!entry || entry.userId !== userId) throw new Error("Grocery entry not found");
  return entry;
}

// Unchecked entries, then entries checked in the last week; the page orders them for display.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    const since = Date.now() - SHOW_CHECKED_DAYS * DAY;
    const rows = await ctx.db
      .query("groceryItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(MAX_GROCERY_ROWS);
    return rows.filter((row) => row.checkedAt === undefined || row.checkedAt >= since);
  },
});

// Re-adding a name already on the list replaces that entry, so it comes back unchecked at the top.
export const add = mutation({
  args: { name: v.string(), foodId: v.optional(v.id("foods")) },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const name = args.name.trim().replace(/\s+/g, " ");
    if (!name) throw new Error("Name is empty");
    if (name.length > MAX_NAME_LENGTH) throw new Error("Name is too long");
    const food =
      args.foodId === undefined
        ? await ctx.db
            .query("foods")
            .withIndex("by_name", (q) => q.eq("name", name.toLowerCase()))
            .unique()
        : await ctx.db.get(args.foodId);
    for (const entry of await groceryEntries(ctx, userId)) {
      if (groceryKey(entry.name) === groceryKey(name)) await ctx.db.delete(entry._id);
    }
    return await ctx.db.insert("groceryItems", { userId, name, foodId: food?._id });
  },
});

export const toggle = mutation({
  args: { entryId: v.id("groceryItems") },
  handler: async (ctx, { entryId }) => {
    const entry = await ownEntry(ctx, entryId);
    const checkedAt = entry.checkedAt === undefined ? Date.now() : undefined;
    await ctx.db.patch(entryId, { checkedAt, checkedBy: checkedAt === undefined ? undefined : "user" });
    return { entryId, checkedAt: checkedAt ?? null };
  },
});

export const remove = mutation({
  args: { entryId: v.id("groceryItems") },
  handler: async (ctx, { entryId }) => {
    await ownEntry(ctx, entryId);
    await ctx.db.delete(entryId);
  },
});

// The "clear" link under the checked entries.
export const clearChecked = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    const checked = (await groceryEntries(ctx, userId)).filter((entry) => entry.checkedAt !== undefined);
    for (const entry of checked) await ctx.db.delete(entry._id);
    return checked.length;
  },
});
