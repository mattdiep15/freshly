import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getUserId } from "./model/auth";
import { askJson, TIPS_SCHEMA, TIPS_SYSTEM_PROMPT } from "./model/llm";
import { importReferenceFoods } from "./model/foods";

// items.get and items.list show a food's tip until the user has dismissed it this many times.
export const TIP_VIEWS_TO_LEARN = 3;
const TIP_BATCH = 25;
const CATALOG_LIMIT = 2000;

// Safe to re-run: upserts by name and merges per location.
export const importReference = internalMutation({
  args: {},
  handler: async (ctx) => importReferenceFoods(ctx),
});

const MERGED_FIELDS = [
  "fridgeDays",
  "freezerDays",
  "pantryDays",
  "storageTip",
  "freshnessHint",
  "defaultWeightGrams",
  "hasPrintedDate",
  "webLookupAt",
] as const;

// One-off cleanup for prod's duplicate names. Dry run unless apply is true: keeps the most complete row per name,
// fills its missing fields from the others, repoints items, grocery rows, and familiarity, then deletes the rest.
export const dedupeByName = internalMutation({
  args: { apply: v.optional(v.boolean()) },
  handler: async (ctx, { apply = false }) => {
    const byName = new Map<string, Doc<"foods">[]>();
    for await (const food of ctx.db.query("foods")) {
      byName.set(food.name, [...(byName.get(food.name) ?? []), food]);
    }
    const filled = (food: Doc<"foods">) => MERGED_FIELDS.filter((key) => food[key] !== undefined).length;
    const groups = [...byName.values()]
      .filter((rows) => rows.length > 1)
      .map((rows) => {
        // Most filled fields first, then the oldest row.
        const [keep, ...drop] = [...rows].sort((a, b) => filled(b) - filled(a) || a._creationTime - b._creationTime);
        return { keep, drop };
      });
    const counts = { items: 0, groceryItems: 0, familiarity: 0, deleted: 0 };
    const keeperOf = new Map<Id<"foods">, Id<"foods">>();
    for (const { keep, drop } of groups) for (const food of drop) keeperOf.set(food._id, keep._id);

    if (apply) {
      for (const { keep, drop } of groups) {
        const patch: Partial<Doc<"foods">> = { aliases: [...new Set([keep.aliases, ...drop.map((f) => f.aliases)].flat())] };
        for (const key of MERGED_FIELDS) {
          const value = keep[key] ?? drop.find((f) => f[key] !== undefined)?.[key];
          if (value !== undefined && keep[key] === undefined) Object.assign(patch, { [key]: value });
        }
        await ctx.db.patch(keep._id, patch);
      }
    }
    for await (const item of ctx.db.query("items")) {
      const keep = item.foodId && keeperOf.get(item.foodId);
      if (!keep) continue;
      counts.items++;
      if (apply) await ctx.db.patch(item._id, { foodId: keep });
    }
    for await (const entry of ctx.db.query("groceryItems")) {
      const keep = entry.foodId && keeperOf.get(entry.foodId);
      if (!keep) continue;
      counts.groceryItems++;
      if (apply) await ctx.db.patch(entry._id, { foodId: keep });
    }
    for await (const row of ctx.db.query("foodFamiliarity")) {
      const keep = keeperOf.get(row.foodId);
      if (!keep) continue;
      counts.familiarity++;
      if (!apply) continue;
      // A user can already have a row for the kept food; fold this one into it.
      const existing = await ctx.db
        .query("foodFamiliarity")
        .withIndex("by_user_food", (q) => q.eq("userId", row.userId).eq("foodId", keep))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          timesAdded: existing.timesAdded + row.timesAdded,
          tipViews: Math.max(existing.tipViews, row.tipViews),
        });
        await ctx.db.delete(row._id);
      } else {
        await ctx.db.patch(row._id, { foodId: keep });
      }
    }
    if (apply) {
      for (const id of keeperOf.keys()) await ctx.db.delete(id);
      counts.deleted = keeperOf.size;
    }
    return {
      applied: apply,
      duplicateNames: groups.length,
      groups: groups.map(({ keep, drop }) => ({ name: keep.name, keep: keep._id, drop: drop.map((f) => f._id) })),
      repointed: counts,
    };
  },
});

// Manual-entry autocomplete; ranges drop their ref to keep the payload small.
export const catalog = query({
  args: {},
  handler: async (ctx) => {
    await getUserId(ctx);
    const range = (r: Doc<"foods">["fridgeDays"]) =>
      r && { min: r.min, max: r.max, source: r.source };
    // The reference import is about 700 rows; the cap keeps the payload bounded as LLM-added foods grow.
    return (await ctx.db.query("foods").take(CATALOG_LIMIT)).map((f) => ({
      name: f.name,
      aliases: f.aliases,
      category: f.category,
      fridgeDays: range(f.fridgeDays),
      freezerDays: range(f.freezerDays),
    }));
  },
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
      .filter((f) => !f.storageTip || !f.freshnessHint || f.hasPrintedDate === undefined)
      .map((f) => ({ foodId: f._id, name: f.name, category: f.category })),
});

// Fills only a missing tip, hint, or printed-date flag, never a shelf-life range.
export const saveTips = internalMutation({
  args: {
    tips: v.array(
      v.object({ foodId: v.id("foods"), storageTip: v.string(), freshnessHint: v.string(), hasPrintedDate: v.boolean() }),
    ),
  },
  handler: async (ctx, { tips }) => {
    let updated = 0;
    for (const tip of tips) {
      const food = await ctx.db.get(tip.foodId);
      if (!food) continue;
      const patch: Partial<typeof food> = {};
      if (!food.storageTip) patch.storageTip = { text: tip.storageTip, source: "llm" };
      if (!food.freshnessHint) patch.freshnessHint = { text: tip.freshnessHint, source: "llm" };
      if (food.hasPrintedDate === undefined) patch.hasPrintedDate = tip.hasPrintedDate;
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
    const { tips } = (await askJson(TIPS_SYSTEM_PROMPT, [{ type: "text", text: list }], TIPS_SCHEMA)) as {
      tips: { number: number; storageTip: string; freshnessHint: string; hasPrintedDate: boolean }[];
    };
    const matched = tips.flatMap(({ number, ...tip }) => {
      const food = batch[number - 1];
      return food ? [{ foodId: food.foodId, ...tip }] : [];
    });
    const updated: number = await ctx.runMutation(internal.foods.saveTips, { tips: matched });
    console.log(`backfillTips: filled ${updated}, ${missing.length - updated} left`);
    // Stop when a batch fills nothing, so a bad response cannot loop forever.
    if (updated > 0 && missing.length > updated) await ctx.scheduler.runAfter(0, internal.foods.backfillTips, {});
    return { missing: missing.length, updated };
  },
});
