import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action, mutation } from "./_generated/server";
import { runLifecycleTick, type TickResult } from "./lifecycle";
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

// TODO(release): remove dev.pushTest
export const pushTest = action({
  args: {},
  handler: async (ctx): Promise<PushTestResult> => {
    if (process.env.ALLOW_DEMO_USER !== "true") throw new Error("dev.pushTest needs ALLOW_DEMO_USER=true");
    const { userId } = await ctx.runQuery(api.profiles.me, {});
    return await ctx.runAction(internal.pushNode.sendTest, { userId });
  },
});
