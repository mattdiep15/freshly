import { v } from "convex/values";
import { summarizeBetween, summarizeWaste, weeklySummaries } from "../lib/wasteStats";
import { query } from "./_generated/server";
import { getUserId } from "./model/auth";
import { loadResolved, streakFor, utcOffsetFor } from "./model/stats";

export const summary = query({
  args: { range: v.optional(v.union(v.literal("week"), v.literal("month"), v.literal("all"))) },
  handler: async (ctx, { range = "week" }) => {
    const userId = await getUserId(ctx);
    return summarizeWaste(await loadResolved(ctx, userId), range, Date.now(), await utcOffsetFor(ctx, userId));
  },
});

export const streak = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    return { streakDays: await streakFor(ctx, userId, Date.now()) };
  },
});

const RECENT_WEEKS = 4;

// The my-numbers circles and table: the last four calendar weeks, each and combined.
export const weeks = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    const now = Date.now();
    const resolved = await loadResolved(ctx, userId);
    const weeks = weeklySummaries(resolved, RECENT_WEEKS, now, await utcOffsetFor(ctx, userId));
    return { weeks, total: summarizeBetween(resolved, weeks[weeks.length - 1].start, now) };
  },
});
