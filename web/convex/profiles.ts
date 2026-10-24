import { v } from "convex/values";
import { DEFAULT_WASTED_FRACTION } from "../lib/wasteStats";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getUserId } from "./model/auth";

async function profileFor(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    return { userId, profile: await profileFor(ctx, userId) };
  },
});

export async function settingsFor(ctx: QueryCtx, userId: Id<"users">) {
  const profile = await profileFor(ctx, userId);
  return {
    wastedFraction: profile?.wastedFraction ?? DEFAULT_WASTED_FRACTION,
    alwaysAskSpoiled: profile?.alwaysAskSpoiled ?? false,
  };
}

export const settings = query({
  args: {},
  handler: async (ctx) => settingsFor(ctx, await getUserId(ctx)),
});

export const updateSettings = mutation({
  args: { wastedFraction: v.optional(v.number()), alwaysAskSpoiled: v.optional(v.boolean()) },
  handler: async (ctx, { wastedFraction, alwaysAskSpoiled }) => {
    const userId = await getUserId(ctx);
    if (wastedFraction !== undefined && !(wastedFraction >= 0 && wastedFraction <= 1)) {
      throw new Error("wastedFraction must be between 0 and 1");
    }
    const profile = await profileFor(ctx, userId);
    if (!profile) throw new Error("Profile not found");
    await ctx.db.patch(profile._id, {
      ...(wastedFraction !== undefined && { wastedFraction }),
      ...(alwaysAskSpoiled !== undefined && { alwaysAskSpoiled }),
    });
    return await settingsFor(ctx, userId);
  },
});
