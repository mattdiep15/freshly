import { streakDays } from "../../lib/streak";
import { DEFAULT_WASTED_FRACTION, type ResolvedItem } from "../../lib/wasteStats";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

// Unswiped expired cards count as tossed at expiry, as in the streak, so skipping cards cannot raise % used.
export async function loadResolved(ctx: QueryCtx, userId: Id<"users">): Promise<ResolvedItem[]> {
  const resolved: ResolvedItem[] = [];
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  const pending = await ctx.db
    .query("items")
    .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "expired"))
    .collect();
  const fractionWasted = profile?.wastedFraction ?? DEFAULT_WASTED_FRACTION;
  for (const { expiresAt, priceCents, weightGrams } of pending) {
    if (expiresAt === undefined) continue;
    resolved.push({ status: "wasted", resolvedAt: expiresAt, fractionWasted, priceCents, weightGrams });
  }
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
  return resolved;
}

// An unswiped expired card counts as waste at its expiry, so ignoring cards does not protect a streak.
export async function streakInputs(ctx: QueryCtx, userId: Id<"users">) {
  let lastWasteAt: number | undefined;
  let firstItemAt: number | undefined;
  for await (const item of ctx.db.query("items").withIndex("by_user_status", (q) => q.eq("userId", userId))) {
    if (item.status === "draft") continue;
    firstItemAt = Math.min(firstItemAt ?? Infinity, item.purchasedAt);
    const wasteAt = item.status === "wasted" ? item.resolvedAt : item.status === "expired" ? item.expiresAt : undefined;
    if (wasteAt !== undefined) lastWasteAt = Math.max(lastWasteAt ?? -Infinity, wasteAt);
  }
  return { lastWasteAt, firstItemAt };
}

// Periods and streak days follow the user's local calendar.
export async function utcOffsetFor(ctx: QueryCtx, userId: Id<"users">): Promise<number> {
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return profile?.utcOffsetMinutes ?? 0;
}

export async function streakFor(ctx: QueryCtx, userId: Id<"users">, now: number): Promise<number> {
  return streakDays({ ...(await streakInputs(ctx, userId)), now, utcOffsetMinutes: await utcOffsetFor(ctx, userId) });
}
