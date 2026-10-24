import { query } from "./_generated/server";
import { getUserId } from "./model/auth";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return { userId, profile };
  },
});
