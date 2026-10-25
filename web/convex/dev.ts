import { v } from "convex/values";
import { buildDigest, daysLeft, localDateKey } from "../lib/digest";
import { api, internal } from "./_generated/api";
import { action, mutation } from "./_generated/server";
import { runLifecycleTick, type TickResult } from "./lifecycle";
import { getUserId } from "./model/auth";
import type { PushTestResult } from "./pushNode";
import { seedDemo } from "./seed";

// TODO(release): remove dev.reseed
export const reseed = mutation({
  args: {},
  handler: async (ctx) => {
    if (process.env.ALLOW_DEMO_USER !== "true") throw new Error("dev.reseed needs ALLOW_DEMO_USER=true");
    return await seedDemo(ctx);
  },
});

// TODO(release): remove dev.runTick
export const runTick = mutation({
  args: { now: v.optional(v.number()), force: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<TickResult> => {
    if (process.env.ALLOW_DEMO_USER !== "true") throw new Error("dev.runTick needs ALLOW_DEMO_USER=true");
    return await runLifecycleTick(ctx, args);
  },
});

// TODO(release): remove dev.pushReminder
export const pushReminder = mutation({
  args: { days: v.union(v.literal(1), v.literal(3), v.literal(7)) },
  handler: async (ctx, { days }) => {
    if (process.env.ALLOW_DEMO_USER !== "true") throw new Error("dev.pushReminder needs ALLOW_DEMO_USER=true");
    const userId = await getUserId(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const utcOffsetMinutes = profile?.utcOffsetMinutes ?? 0;
    const now = Date.now();
    const active = await ctx.db
      .query("items")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .collect();
    const due = active.flatMap((i) =>
      i.expiresAt !== undefined && daysLeft(i.expiresAt, now, utcOffsetMinutes) === days
        ? [{ _id: i._id, name: i.name, expiresAt: i.expiresAt }]
        : [],
    );
    // Zero reviews and undated items keep the message to the one reminder group.
    const digest = buildDigest(due, 0, 0, now, utcOffsetMinutes);
    if (!digest) return { sent: false, reason: `No active item expires in ${days} days. Open /api/dev/seed to reset.` };
    const notificationId = await ctx.db.insert("notifications", {
      userId,
      kind: "digest",
      dateKey: localDateKey(now, utcOffsetMinutes),
      ...digest,
    });
    await ctx.scheduler.runAfter(0, internal.pushNode.send, { notificationId });
    return { sent: true, notificationId, title: digest.title, body: digest.body };
  },
});

// TODO(release): remove dev.pushTest
export const pushTest = action({
  args: {},
  handler: async (ctx): Promise<PushTestResult> => {
    if (process.env.ALLOW_DEMO_USER !== "true") throw new Error("dev.pushTest needs ALLOW_DEMO_USER=true");
    const { userId } = await ctx.runQuery(api.profiles.me, {});
    return await ctx.runAction(internal.pushNode.sendTest, { userId });
  },
});
