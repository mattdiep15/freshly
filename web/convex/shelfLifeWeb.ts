import { v } from "convex/values";
import { expiryFor } from "../lib/expiry";
import { allowedSite, needsWebLookup, pickWebRanges, type WebEntry, type WebPage } from "../lib/webShelfLife";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, type MutationCtx } from "./_generated/server";
import { searchPages } from "./model/apify";
import { askClaude } from "./model/claude";
import { askGemini } from "./model/gemini";
import { WEB_SHELF_LIFE_SCHEMA, webShelfLifeSystemPrompt } from "./model/llm";
import { shelfLife } from "./schema";

// Starts a lookup chain when any of these foods needs one; each chain claims foods one at a time.
export async function scheduleWebLookup(ctx: MutationCtx, foodIds: (Id<"foods"> | undefined)[]) {
  for (const foodId of foodIds) {
    if (!foodId || !needsWebLookup(await ctx.db.get(foodId))) continue;
    await ctx.scheduler.runAfter(0, internal.shelfLifeWeb.lookupNext, {});
    return;
  }
}

// Marks the next food that needs a lookup, so two chains never search the same food.
export const claimNext = internalMutation({
  args: {},
  handler: async (ctx) => {
    const food = (await ctx.db.query("foods").collect()).find(needsWebLookup);
    if (!food) return null;
    await ctx.db.patch(food._id, { webLookupAt: Date.now() });
    return { foodId: food._id, name: food.name };
  },
});

// A failed lookup is retried by the next chain instead of being marked done.
export const release = internalMutation({
  args: { foodId: v.id("foods") },
  handler: async (ctx, { foodId }) => {
    await ctx.db.patch(foodId, { webLookupAt: undefined });
  },
});

// Fills only empty locations, then dates this food's undated drafts and active items; a date already set is never changed.
export const saveRanges = internalMutation({
  args: {
    foodId: v.id("foods"),
    ranges: v.object({ fridgeDays: v.optional(shelfLife), freezerDays: v.optional(shelfLife), pantryDays: v.optional(shelfLife) }),
  },
  handler: async (ctx, { foodId, ranges }) => {
    const food = await ctx.db.get(foodId);
    if (!food) return { saved: 0, dated: 0 };
    const patch: Partial<typeof food> = {};
    for (const key of ["fridgeDays", "freezerDays", "pantryDays"] as const) {
      if (ranges[key] && !food[key]) patch[key] = ranges[key];
    }
    if (Object.keys(patch).length === 0) return { saved: 0, dated: 0 };
    await ctx.db.patch(foodId, patch);
    const updated = { ...food, ...patch };
    const undated = [];
    for (const status of ["draft", "active"] as const) {
      undated.push(
        ...(await ctx.db
          .query("items")
          .withIndex("by_status_expires", (q) => q.eq("status", status).eq("expiresAt", undefined))
          .collect()),
      );
    }
    let dated = 0;
    for (const item of undated) {
      if (item.foodId !== foodId || item.expirySource) continue;
      const expiry = expiryFor(updated, item.location, item.purchasedAt);
      if (!expiry) continue;
      await ctx.db.patch(item._id, expiry);
      dated++;
    }
    return { saved: Object.keys(patch).length, dated };
  },
});

// Gemini reads the pages for the Gemini track; Claude covers a Gemini outage or a spent free-tier quota.
async function extract(foodName: string, pages: WebPage[]): Promise<WebEntry[]> {
  const system = webShelfLifeSystemPrompt(foodName);
  const parts = pages.map((p) => ({ type: "text" as const, text: `URL: ${p.url}\n\n${p.markdown}` }));
  try {
    return ((await askGemini(system, parts, WEB_SHELF_LIFE_SCHEMA)) as { entries: WebEntry[] }).entries;
  } catch (e) {
    console.warn(`shelfLifeWeb: Gemini failed, using Claude: ${e instanceof Error ? e.message.slice(0, 120) : e}`);
    return ((await askClaude(system, parts, WEB_SHELF_LIFE_SCHEMA)) as { entries: WebEntry[] }).entries;
  }
}

// Run by scheduleWebLookup after a parse or manual add; `npx convex run shelfLifeWeb:lookupNext` backfills existing foods.
export const lookupNext = internalAction({
  args: {},
  handler: async (ctx) => {
    const token = process.env.APIFY_TOKEN;
    if (!token) return console.log("shelfLifeWeb: APIFY_TOKEN is not set; skipping");
    const next = await ctx.runMutation(internal.shelfLifeWeb.claimNext, {});
    if (!next) return;
    try {
      // StillTasty has a page per packaged food; an OR of every allowed site returned fewer usable pages.
      const pages = await searchPages(`${next.name.slice(0, 80)} site:stilltasty.com`, token, allowedSite);
      const entries = pages.length > 0 ? await extract(next.name, pages) : [];
      const ranges = pickWebRanges(entries, pages);
      const result = await ctx.runMutation(internal.shelfLifeWeb.saveRanges, { foodId: next.foodId, ranges });
      console.log(`shelfLifeWeb: ${next.name}: ${pages.length} pages, ${entries.length} figures, saved ${result.saved}, dated ${result.dated}`);
    } catch (e) {
      console.error(`shelfLifeWeb: ${next.name}: ${e instanceof Error ? e.message : e}`);
      await ctx.runMutation(internal.shelfLifeWeb.release, { foodId: next.foodId });
      return;
    }
    await ctx.scheduler.runAfter(0, internal.shelfLifeWeb.lookupNext, {});
  },
});
