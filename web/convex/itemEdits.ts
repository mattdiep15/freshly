import { v } from "convex/values";
import { expiryAfterMove, expiryFor } from "../lib/expiry";
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { getUserId } from "./model/auth";
import { checkOffGroceries } from "./model/grocery";
import { bumpTimesAdded, newFood, resolveFood } from "./receipts";
import { location } from "./schema";
import { scheduleWebLookup } from "./shelfLifeWeb";

const DAY = 24 * 60 * 60 * 1000;

// A user-set expiresAt wins; a location change without one recomputes from the sourced range.
export const update = mutation({
  args: {
    itemId: v.id("items"),
    name: v.optional(v.string()),
    quantity: v.optional(v.number()),
    location: v.optional(location),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { itemId, name, quantity, location: loc, expiresAt }) => {
    const userId = await getUserId(ctx);
    const item = await ctx.db.get(itemId);
    if (!item || item.userId !== userId) throw new Error("Item not found");
    if (item.status === "used" || item.status === "wasted") throw new Error("Item is already resolved");
    if (quantity !== undefined && !(quantity > 0)) throw new Error("Quantity must be positive");

    const patch: Partial<typeof item> = {};
    if (name !== undefined) patch.name = name.trim();
    if (quantity !== undefined) patch.quantity = quantity;
    if (loc !== undefined) patch.location = loc;
    if (expiresAt !== undefined) {
      patch.expiresAt = expiresAt;
      patch.expirySource = "user";
    } else if (loc !== undefined && loc !== item.location) {
      const food = item.foodId ? await ctx.db.get(item.foodId) : null;
      const expiry = expiryAfterMove(food, loc, item, Date.now());
      patch.expiresAt = expiry?.expiresAt;
      patch.expirySource = expiry?.expirySource;
    }
    // A new future date puts a swipe card back in the fridge.
    if (item.status === "expired" && patch.expiresAt !== undefined && patch.expiresAt > Date.now()) {
      patch.status = "active";
    }
    await ctx.db.patch(itemId, patch);
    return await ctx.db.get(itemId);
  },
});

// Checks auth before addManual spends a model call; skips the model when the name is already known.
export const manualInput = internalQuery({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    await getUserId(ctx);
    const key = name.toLowerCase().trim();
    const foods = await ctx.db.query("foods").collect();
    const exact = foods.find((f) => f.name === key) ?? foods.find((f) => f.aliases.includes(key));
    return { exactMatch: exact?.name ?? null, foodNames: exact ? [] : foods.map((f) => f.name) };
  },
});

export const insertManual = internalMutation({
  args: {
    name: v.string(),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    location: v.optional(location),
    priceCents: v.optional(v.number()),
    purchasedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    foodName: v.union(v.string(), v.null()),
    newFood: v.union(newFood, v.null()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const food = await resolveFood(ctx, args.foodName, args.newFood);
    const loc = args.location ?? food?.defaultLocation ?? "fridge";
    if (args.quantity !== undefined && !(args.quantity > 0)) throw new Error("Quantity must be positive");
    if (args.purchasedAt !== undefined && args.purchasedAt > Date.now() + DAY) throw new Error("Purchase date is in the future");
    const purchasedAt = args.purchasedAt ?? Date.now();
    const expiry =
      args.expiresAt !== undefined
        ? { expiresAt: args.expiresAt, expirySource: "user" as const }
        : expiryFor(food, loc, purchasedAt);
    const itemId = await ctx.db.insert("items", {
      userId,
      foodId: food?._id,
      name: args.name,
      quantity: args.quantity ?? 1,
      unit: args.unit,
      priceCents: args.priceCents,
      weightGrams: food?.defaultWeightGrams,
      location: loc,
      purchasedAt,
      expiresAt: expiry?.expiresAt,
      expirySource: expiry?.expirySource,
      status: "active",
    });
    if (food) await bumpTimesAdded(ctx, userId, food._id);
    await checkOffGroceries(ctx, userId, [{ name: args.name, foodId: food?._id }]);
    await scheduleWebLookup(ctx, [food?._id]);
    return itemId;
  },
});

// Undo for a manual add; only an item that is still active can be taken back.
export const remove = mutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    const userId = await getUserId(ctx);
    const item = await ctx.db.get(itemId);
    if (!item || item.userId !== userId) throw new Error("Item not found");
    if (item.status !== "active") throw new Error(`Item is ${item.status}; only active items can be removed`);
    await ctx.db.delete(itemId);
  },
});
