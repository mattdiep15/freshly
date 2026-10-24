import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export const DEMO_EMAIL = "demo@freshly.test";

// Every public function gets the user here, so swapping auth providers touches one file.
export async function getUserId(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId !== null) return userId;
  // TODO(release): remove demo-user fallback
  if (process.env.ALLOW_DEMO_USER === "true") {
    const demo = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", DEMO_EMAIL))
      .unique();
    if (demo) return demo._id;
    throw new Error("Demo user not seeded. Open /api/dev/seed first.");
  }
  throw new Error("Not signed in");
}
