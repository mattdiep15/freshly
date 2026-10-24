import { v } from "convex/values";
import { buildDigest, isDigestDue, localDateKey } from "../lib/digest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";

const RECENT_NOTIFICATIONS = 14;

export type TickResult = { expired: number; digests: Id<"notifications">[] };

export async function runLifecycleTick(
  ctx: MutationCtx,
  { now = Date.now(), force = false }: { now?: number; force?: boolean },
): Promise<TickResult> {
  // gte(0) keeps undated items out: Convex sorts a missing field before every number.
  const expiring = await ctx.db
    .query("items")
    .withIndex("by_status_expires", (q) => q.eq("status", "active").gte("expiresAt", 0).lte("expiresAt", now))
    .collect();
  for (const item of expiring) await ctx.db.patch(item._id, { status: "expired" });

  // TODO(release): scan only profiles due this hour once there are many users
  const profiles = await ctx.db.query("profiles").collect();
  const digests: Id<"notifications">[] = [];
  for (const profile of profiles) {
    const { userId, utcOffsetMinutes, digestHour } = profile;
    if (!force && !isDigestDue(now, utcOffsetMinutes, digestHour)) continue;
    const dateKey = localDateKey(now, utcOffsetMinutes);
    const sentToday = await ctx.db
      .query("notifications")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("dateKey", dateKey))
      .first();
    if (!force && sentToday) continue;

    const active = await ctx.db
      .query("items")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .collect();
    const pendingReviews = (
      await ctx.db
        .query("items")
        .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "expired"))
        .collect()
    ).length;
    const dated = active.flatMap((i) => (i.expiresAt === undefined ? [] : [{ _id: i._id, name: i.name, expiresAt: i.expiresAt }]));
    const recent = await ctx.db
      .query("notifications")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).lte("dateKey", dateKey))
      .order("desc")
      .take(RECENT_NOTIFICATIONS);
    const lastNudge = recent.find((n) => n.undatedCount !== undefined)?.dateKey;
    const digest = buildDigest(dated, pendingReviews, active.length - dated.length, now, utcOffsetMinutes, lastNudge);
    if (!digest) continue;

    const notificationId = await ctx.db.insert("notifications", { userId, kind: "digest", dateKey, ...digest });
    await ctx.scheduler.runAfter(0, internal.pushNode.send, { notificationId });
    digests.push(notificationId);
  }
  return { expired: expiring.length, digests };
}

// Hourly: expire past-date items into swipe cards, then send each due user one digest.
export const tick = internalMutation({
  args: { now: v.optional(v.number()), force: v.optional(v.boolean()) },
  handler: async (ctx, args) => runLifecycleTick(ctx, args),
});
