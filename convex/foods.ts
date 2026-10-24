import { internalMutation } from "./_generated/server";
import { importReferenceFoods } from "./model/foods";

// Safe to re-run: upserts by name and merges per location.
export const importReference = internalMutation({
  args: {},
  handler: async (ctx) => importReferenceFoods(ctx),
});
