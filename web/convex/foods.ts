import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
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
      .map((f) => ({ foodId: f._id, name: f.name, category: f.category })),
});

// Fills only the missing tip or hint, never a shelf-life range.
export const saveTips = internalMutation({
  args: { tips: v.array(v.object({ foodId: v.id("foods"), storageTip: v.string(), freshnessHint: v.string() })) },
  handler: async (ctx, { tips }) => {
    let updated = 0;
    for (const tip of tips) {
      const food = await ctx.db.get(tip.foodId);
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

// Run once after foods:importReference: `npx convex run foods:backfillTips`. One batch per run keeps each under the action time limit.
export const backfillTips = internalAction({
  args: {},
  handler: async (ctx): Promise<{ missing: number; updated: number }> => {
    const missing: { foodId: Id<"foods">; name: string; category: string }[] = await ctx.runQuery(
      internal.foods.missingTips,
      {},
    );
    if (missing.length === 0) return { missing: 0, updated: 0 };
    const batch = missing.slice(0, TIP_BATCH);
    // Numbered so the model never has to copy food names back exactly.
    const list = batch.map((f, i) => `${i + 1}. ${f.name} (${f.category})`).join("\n");
    const { tips } = (await askJson(anthropicClient(), TIPS_SYSTEM_PROMPT, [{ type: "text", text: list }], TIPS_SCHEMA)) as {
      tips: { number: number; storageTip: string; freshnessHint: string }[];
    };
    const matched = tips.flatMap(({ number, storageTip, freshnessHint }) => {
      const food = batch[number - 1];
      return food ? [{ foodId: food.foodId, storageTip, freshnessHint }] : [];
    });
    const updated: number = await ctx.runMutation(internal.foods.saveTips, { tips: matched });
    console.log(`backfillTips: filled ${updated}, ${missing.length - updated} left`);
    // Stop when a batch fills nothing, so a bad response cannot loop forever.
    if (updated > 0 && missing.length > updated) await ctx.scheduler.runAfter(0, internal.foods.backfillTips, {});
    return { missing: missing.length, updated };
  },
});
