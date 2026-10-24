import { query } from "./_generated/server";
import { extendedExpiry, toItemViews } from "./items";
import { getUserId } from "./model/auth";

// Expired items waiting for a used/wasted swipe, oldest expiry first.
export const pending = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    const rows = await ctx.db
      .query("items")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "expired"))
      .collect();
    const now = Date.now();
    const views = await toItemViews(ctx, userId, rows);
    return await Promise.all(
      views.map(async (view) => {
        const food = view.foodId ? await ctx.db.get(view.foodId) : null;
        // Tells the UI whether the second card offers "1-2 more days" or only "toss".
        return { ...view, canExtend: extendedExpiry(view, food, now) !== null };
      }),
    );
  },
});
