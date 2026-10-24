import { v } from "convex/values";
import { localDateKey } from "../lib/digest";
import { mutation, query } from "./_generated/server";
import { getUserId } from "./model/auth";

const DAY = 24 * 60 * 60 * 1000;
const FEED_DAYS = 30;

// In-app feed, newest first; the fallback where push is unavailable.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    const since = localDateKey(Date.now() - FEED_DAYS * DAY, 0);
    return await ctx.db
      .query("notifications")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).gte("dateKey", since))
      .order("desc")
      .collect();
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    const userId = await getUserId(ctx);
    const notification = await ctx.db.get(notificationId);
    if (!notification || notification.userId !== userId) throw new Error("Notification not found");
    if (notification.readAt === undefined) await ctx.db.patch(notificationId, { readAt: Date.now() });
    return null;
  },
});
