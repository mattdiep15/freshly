import { streakDays } from "../../lib/streak";
import type { ResolvedItem } from "../../lib/wasteStats";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export async function loadResolved(ctx: QueryCtx, userId: Id<"users">): Promise<ResolvedItem[]> {
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

export async function streakFor(ctx: QueryCtx, userId: Id<"users">, now: number): Promise<number> {
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return streakDays({ ...(await streakInputs(ctx, userId)), now, utcOffsetMinutes: profile?.utcOffsetMinutes ?? 0 });
}
