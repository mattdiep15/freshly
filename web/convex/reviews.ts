import { query } from "./_generated/server";
import { toItemViews } from "./items";
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
    return await toItemViews(ctx, userId, rows);
  },
});
