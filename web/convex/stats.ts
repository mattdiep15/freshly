import { v } from "convex/values";
import { summarizeWaste, type ResolvedItem } from "../lib/wasteStats";
import { query } from "./_generated/server";
import { getUserId } from "./model/auth";

export const summary = query({
  args: { range: v.optional(v.union(v.literal("week"), v.literal("month"), v.literal("all"))) },
  handler: async (ctx, { range = "week" }) => {
    const userId = await getUserId(ctx);
    const resolved: ResolvedItem[] = [];
    for (const status of ["used", "wasted"] as const) {
      const rows = await ctx.db
        .query("items")
        .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", status))
        .collect();
      for (const { resolvedAt, fractionWasted, priceCents, weightGrams } of rows) {
        // items.resolve always sets resolvedAt; a row without one only counts toward "all".
        resolved.push({ status, resolvedAt: resolvedAt ?? 0, fractionWasted, priceCents, weightGrams });
      }
    }
    return summarizeWaste(resolved, range, Date.now());
  },
});
