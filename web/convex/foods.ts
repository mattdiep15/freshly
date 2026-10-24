import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import { getUserId } from "./model/auth";
import { anthropicClient, askJson, TIPS_SCHEMA, TIPS_SYSTEM_PROMPT } from "./model/claude";
import { importReferenceFoods } from "./model/foods";

// items.get and items.list show a food's tip until the user has dismissed it this many times.
export const TIP_VIEWS_TO_LEARN = 3;
const TIP_BATCH = 25;

// Safe to re-run: upserts by name and merges per location.
export const importReference = internalMutation({
  args: {},
  handler: async (ctx) => importReferenceFoods(ctx),
});

export const ackTip = mutation({
  args: { foodId: v.id("foods") },
  handler: async (ctx, { foodId }) => {
    const userId = await getUserId(ctx);
    if (!(await ctx.db.get(foodId))) throw new Error("Food not found");
    const row = await ctx.db
      .query("foodFamiliarity")
      .withIndex("by_user_food", (q) => q.eq("userId", userId).eq("foodId", foodId))
      .unique();
    const tipViews = (row?.tipViews ?? 0) + 1;
    if (row) await ctx.db.patch(row._id, { tipViews });
    else await ctx.db.insert("foodFamiliarity", { userId, foodId, timesAdded: 0, tipViews });
    return { tipViews, showTip: tipViews < TIP_VIEWS_TO_LEARN };
  },
});

export const missingTips = internalQuery({
  args: {},
  handler: async (ctx) =>
    (await ctx.db.query("foods").collect())
      .filter((f) => !f.storageTip || !f.freshnessHint)
      .map((f) => ({ name: f.name, category: f.category })),
});

// Fills only the missing tip or hint, never a shelf-life range.
export const saveTips = internalMutation({
  args: { tips: v.array(v.object({ name: v.string(), storageTip: v.string(), freshnessHint: v.string() })) },
  handler: async (ctx, { tips }) => {
    let updated = 0;
    for (const tip of tips) {
      const food = await ctx.db
        .query("foods")
        .withIndex("by_name", (q) => q.eq("name", tip.name))
        .unique();
      if (!food) continue;
      const patch: { storageTip?: { text: string; source: "llm" }; freshnessHint?: { text: string; source: "llm" } } = {};
      if (!food.storageTip) patch.storageTip = { text: tip.storageTip, source: "llm" };
      if (!food.freshnessHint) patch.freshnessHint = { text: tip.freshnessHint, source: "llm" };
      if (Object.keys(patch).length === 0) continue;
      await ctx.db.patch(food._id, patch);
      updated++;
    }
    return updated;
  },
});

// Run once after foods:importReference: `npx convex run foods:backfillTips`.
export const backfillTips = internalAction({
  args: {},
  handler: async (ctx): Promise<{ missing: number; updated: number }> => {
    const missing: { name: string; category: string }[] = await ctx.runQuery(internal.foods.missingTips, {});
    const client = anthropicClient();
    let updated = 0;
    for (let i = 0; i < missing.length; i += TIP_BATCH) {
      const batch = missing.slice(i, i + TIP_BATCH);
      const list = batch.map((f) => `${f.name} (${f.category})`).join("\n");
      const { tips } = (await askJson(client, TIPS_SYSTEM_PROMPT, [{ type: "text", text: list }], TIPS_SCHEMA)) as {
        tips: { name: string; storageTip: string; freshnessHint: string }[];
      };
      updated += await ctx.runMutation(internal.foods.saveTips, { tips });
      console.log(`backfillTips: ${Math.min(i + TIP_BATCH, missing.length)}/${missing.length}`);
    }
    return { missing: missing.length, updated };
  },
});
