import { v } from "convex/values";
import { groceryKey } from "../lib/grocery";
import { mutation, query } from "./_generated/server";
import { getUserId } from "./model/auth";

const MAX_ROWS = 200;
const MAX_NAME_LENGTH = 80;

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    return await ctx.db
      .query("groceryItems")
      .withIndex("by_user_added", (q) => q.eq("userId", userId))
      .order("desc")
      .take(MAX_ROWS);
  },
});

// Re-adding a name already on the list moves that row to the top instead of duplicating it.
export const add = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await getUserId(ctx);
    const display = name.trim().replace(/\s+/g, " ");
    if (!display) throw new Error("Name is empty");
    if (display.length > MAX_NAME_LENGTH) throw new Error("Name is too long");
    const key = groceryKey(display);
    const existing = await ctx.db
      .query("groceryItems")
      .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("key", key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { completed: false, addedAt: Date.now() });
      return existing._id;
    }
    return await ctx.db.insert("groceryItems", { userId, name: display, key, completed: false, addedAt: Date.now() });
  },
});

export const setCompleted = mutation({
  args: { groceryItemId: v.id("groceryItems"), completed: v.boolean() },
  handler: async (ctx, { groceryItemId, completed }) => {
    const userId = await getUserId(ctx);
    const row = await ctx.db.get(groceryItemId);
    if (!row || row.userId !== userId) throw new Error("Grocery item not found");
    await ctx.db.patch(groceryItemId, { completed });
  },
});

export const clearCompleted = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    const done = await ctx.db
      .query("groceryItems")
      .withIndex("by_user_completed", (q) => q.eq("userId", userId).eq("completed", true))
      .take(MAX_ROWS);
    for (const row of done) await ctx.db.delete(row._id);
    return done.length;
  },
});
