import { v } from "convex/values";
import { groceryKey } from "../lib/grocery";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getUserId } from "./model/auth";
import { groceryEntries, MAX_GROCERY_ROWS } from "./model/grocery";

const DAY = 24 * 60 * 60 * 1000;
const SHOW_CHECKED_DAYS = 7;
const MAX_NAME_LENGTH = 80;
const MAX_RECIPE_NAMES = 40;

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
async function insertEntry(
  ctx: MutationCtx,
  userId: Id<"users">,
  rawName: string,
  { foodId, recipeName }: { foodId?: Id<"foods">; recipeName?: string } = {},
) {
  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Name is empty");
  if (name.length > MAX_NAME_LENGTH) throw new Error("Name is too long");
  const food =
    foodId === undefined
      ? await ctx.db
          .query("foods")
          .withIndex("by_name", (q) => q.eq("name", name.toLowerCase()))
          .unique()
      : await ctx.db.get(foodId);
  for (const entry of await groceryEntries(ctx, userId)) {
    if (groceryKey(entry.name) === groceryKey(name)) await ctx.db.delete(entry._id);
  }
  return await ctx.db.insert("groceryItems", { userId, name, foodId: food?._id, recipeName });
}

export const add = mutation({
  args: { name: v.string(), foodId: v.optional(v.id("foods")) },
  handler: async (ctx, { name, foodId }) => insertEntry(ctx, await getUserId(ctx), name, { foodId }),
});

// A recipe's missing ingredients; names already unchecked on the list are skipped, so undo removes only what this added.
export const addFromRecipe = mutation({
  args: { recipeName: v.string(), names: v.array(v.string()) },
  handler: async (ctx, { recipeName, names }) => {
    const userId = await getUserId(ctx);
    const recipe = recipeName.trim();
    if (!recipe || recipe.length > MAX_NAME_LENGTH) throw new Error("Recipe name is empty or too long");
    if (names.length > MAX_RECIPE_NAMES) throw new Error("Too many ingredients");
    const listed = new Set(
      (await groceryEntries(ctx, userId)).filter((entry) => entry.checkedAt === undefined).map((entry) => groceryKey(entry.name)),
    );
    const added: { entryId: Id<"groceryItems">; name: string }[] = [];
    for (const name of names) {
      if (listed.has(groceryKey(name))) continue;
      listed.add(groceryKey(name));
      added.push({ entryId: await insertEntry(ctx, userId, name, { recipeName: recipe }), name: name.trim() });
    }
    return added;
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
