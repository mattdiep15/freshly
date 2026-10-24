import { mutation } from "./_generated/server";
import { seedDemo } from "./seed";

// TODO(release): remove dev.reseed
export const reseed = mutation({
  args: {},
  handler: async (ctx) => {
    if (process.env.ALLOW_DEMO_USER !== "true") throw new Error("dev.reseed needs ALLOW_DEMO_USER=true");
    return await seedDemo(ctx);
  },
});
