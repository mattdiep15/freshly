import { v, type Infer } from "convex/values";
import { expiryFor } from "../lib/expiry";
import { localDateKey } from "../lib/digest";
import { purchaseDate, receiptDayToMs, verifierMismatches } from "../lib/receiptCheck";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { toItemViews, utcOffsetFor } from "./items";
import { getUserId } from "./model/auth";
import { checkOffGroceries } from "./model/grocery";
import { requestSuggestion } from "./recipes";
import { location } from "./schema";
import { scheduleWebLookup } from "./shelfLifeWeb";

export const newFood = v.object({
  name: v.string(),
  category: v.string(),
  defaultLocation: location,
  defaultWeightGrams: v.union(v.number(), v.null()),
  storageTip: v.string(),
  freshnessHint: v.string(),
  hasPrintedDate: v.boolean(),
});

const receiptLine = v.object({
  rawText: v.string(),
  displayName: v.string(),
  quantity: v.number(),
  unit: v.union(v.string(), v.null()),
  priceCents: v.number(),
  weightGrams: v.union(v.number(), v.null()),
  foodName: v.union(v.string(), v.null()),
  newFood: v.union(newFood, v.null()),
});

// Mirrors RECEIPT_SCHEMA in convex/model/llm.ts.
export const receiptResult = v.object({
  isReceipt: v.boolean(),
  storeName: v.union(v.string(), v.null()),
  purchasedAt: v.union(v.string(), v.null()),
  totalCents: v.union(v.number(), v.null()),
  lines: v.array(receiptLine),
});

const fileType = v.union(v.literal("image"), v.literal("pdf"));

async function ownReceipt(ctx: QueryCtx, receiptId: Id<"receipts">) {
  const userId = await getUserId(ctx);
  const receipt = await ctx.db.get(receiptId);
  if (!receipt || receipt.userId !== userId) throw new Error("Receipt not found");
  return receipt;
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await getUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: { fileId: v.id("_storage"), fileType },
  handler: async (ctx, { fileId, fileType }) => {
    const userId = await getUserId(ctx);
    const receiptId = await ctx.db.insert("receipts", { userId, fileId, fileType, status: "uploaded" });
    await ctx.scheduler.runAfter(0, internal.receiptsNode.parse, { receiptId });
    return receiptId;
  },
});

export const get = query({
  args: { receiptId: v.id("receipts") },
  handler: async (ctx, { receiptId }) => {
    // Null instead of throwing: a reset can delete the receipt while its review page is open.
    const userId = await getUserId(ctx);
    const receipt = await ctx.db.get(receiptId);
    if (!receipt || receipt.userId !== userId) return null;
    const items = await ctx.db
      .query("items")
      .withIndex("by_receipt", (q) => q.eq("receiptId", receiptId))
      .collect();
    const drafts = await toItemViews(
      ctx,
      receipt.userId,
      items.filter((i) => i.status === "draft"),
    );
    return { ...receipt, drafts };
  },
});

// Flips the receipt's drafts to active; ids in removeItemIds are deleted instead.
export const confirmDrafts = mutation({
  args: { receiptId: v.id("receipts"), removeItemIds: v.optional(v.array(v.id("items"))) },
  handler: async (ctx, { receiptId, removeItemIds = [] }) => {
    const receipt = await ownReceipt(ctx, receiptId);
    const drafts = (
      await ctx.db
        .query("items")
        .withIndex("by_receipt", (q) => q.eq("receiptId", receiptId))
        .collect()
    ).filter((i) => i.status === "draft");
    const remove = new Set<Id<"items">>(removeItemIds);
    const kept = drafts.filter((item) => !remove.has(item._id));
    for (const item of drafts) {
      if (remove.has(item._id)) {
        await ctx.db.delete(item._id);
        continue;
      }
      await ctx.db.patch(item._id, { status: "active" });
      if (item.foodId) await bumpTimesAdded(ctx, receipt.userId, item.foodId);
    }
    await checkOffGroceries(ctx, receipt.userId, kept);
    await requestSuggestion(ctx, receipt.userId, { preload: true });
    return { confirmed: kept.length, removed: drafts.length - kept.length };
  },
});

// The user's confirmed purchase date: re-dates drafts from their sourced ranges, keeps dates the user typed.
export const setPurchasedAt = mutation({
  args: { receiptId: v.id("receipts"), date: v.string() },
  handler: async (ctx, { receiptId, date }) => {
    const receipt = await ownReceipt(ctx, receiptId);
    if (receipt.status !== "parsed") throw new Error("Receipt is not parsed yet");
    const purchasedAt = receiptDayToMs(date, await utcOffsetFor(ctx, receipt.userId));
    if (purchasedAt === null) throw new Error("Purchase date must be YYYY-MM-DD");
    // One day of slack, since noon today can still be ahead of now.
    if (purchasedAt > Date.now() + 24 * 60 * 60 * 1000) throw new Error("Purchase date is in the future");
    const drafts = (
      await ctx.db
        .query("items")
        .withIndex("by_receipt", (q) => q.eq("receiptId", receiptId))
        .collect()
    ).filter((i) => i.status === "draft");
    for (const item of drafts) {
      if (item.expirySource === "user") {
        await ctx.db.patch(item._id, { purchasedAt });
        continue;
      }
      const food = item.foodId ? await ctx.db.get(item.foodId) : null;
      const expiry = expiryFor(food, item.location, purchasedAt);
      await ctx.db.patch(item._id, { purchasedAt, expiresAt: expiry?.expiresAt, expirySource: expiry?.expirySource });
    }
    const flags = (receipt.reviewFlags ?? []).filter((f) => f !== "implausible_date" && f !== "date_mismatch");
    await ctx.db.patch(receiptId, { purchasedAt, reviewFlags: flags.length > 0 ? flags : undefined });
    return { redated: drafts.length };
  },
});

// The user checked a header field the readers disagreed on; date flags clear through setPurchasedAt instead.
export const dismissFlag = mutation({
  args: { receiptId: v.id("receipts"), flag: v.union(v.literal("store_mismatch"), v.literal("total_mismatch")) },
  handler: async (ctx, { receiptId, flag }) => {
    const receipt = await ownReceipt(ctx, receiptId);
    const flags = (receipt.reviewFlags ?? []).filter((f) => f !== flag);
    await ctx.db.patch(receiptId, { reviewFlags: flags.length > 0 ? flags : undefined });
  },
});

export async function bumpTimesAdded(ctx: MutationCtx, userId: Id<"users">, foodId: Id<"foods">) {
  const row = await ctx.db
    .query("foodFamiliarity")
    .withIndex("by_user_food", (q) => q.eq("userId", userId).eq("foodId", foodId))
    .unique();
  if (row) await ctx.db.patch(row._id, { timesAdded: row.timesAdded + 1 });
  else await ctx.db.insert("foodFamiliarity", { userId, foodId, timesAdded: 1, tipViews: 0 });
}

// Everything parse needs in one read; null when the receipt is gone or already handled.
export const parseInput = internalQuery({
  args: { receiptId: v.id("receipts") },
  handler: async (ctx, { receiptId }) => {
    const receipt = await ctx.db.get(receiptId);
    if (!receipt || receipt.status !== "uploaded") return null;
    const foodNames = (await ctx.db.query("foods").collect()).map((f) => f.name);
    return { fileId: receipt.fileId, fileType: receipt.fileType, foodNames };
  },
});

export const setStatus = internalMutation({
  args: {
    receiptId: v.id("receipts"),
    status: v.union(v.literal("parsing"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { receiptId, status, error }) => {
    await ctx.db.patch(receiptId, { status, error });
  },
});

// Everything verify needs; null unless the receipt parsed.
export const verifyInput = internalQuery({
  args: { receiptId: v.id("receipts") },
  handler: async (ctx, { receiptId }) => {
    const receipt = await ctx.db.get(receiptId);
    if (!receipt || receipt.status !== "parsed") return null;
    return { fileId: receipt.fileId, fileType: receipt.fileType };
  },
});

// Flags only: a disagreement asks the user to confirm and never changes a date by itself.
export const saveVerification = internalMutation({
  args: {
    receiptId: v.id("receipts"),
    header: v.union(
      v.object({ storeName: v.union(v.string(), v.null()), purchasedAt: v.union(v.string(), v.null()), totalCents: v.union(v.number(), v.null()) }),
      v.null(),
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { receiptId, header, error }) => {
    const receipt = await ctx.db.get(receiptId);
    if (!receipt || receipt.status !== "parsed") return;
    if (!header) {
      await ctx.db.patch(receiptId, { verification: { status: "skipped", error } });
      return;
    }
    const offset = await utcOffsetFor(ctx, receipt.userId);
    const printed = receipt.purchasedAt === undefined ? null : localDateKey(receipt.purchasedAt, offset);
    const claude = { storeName: receipt.storeName ?? null, purchasedAt: printed, totalCents: receipt.totalCents ?? null };
    const mismatches = verifierMismatches(claude, header, receipt._creationTime, offset);
    const flags = new Set([...(receipt.reviewFlags ?? []), ...mismatches]);
    await ctx.db.patch(receiptId, {
      reviewFlags: flags.size > 0 ? [...flags] : undefined,
      verification: {
        status: "done",
        storeName: header.storeName ?? undefined,
        purchasedAt: header.purchasedAt ?? undefined,
        totalCents: header.totalCents ?? undefined,
      },
    });
  },
});

export const saveParsed = internalMutation({
  args: { receiptId: v.id("receipts"), result: receiptResult },
  handler: async (ctx, { receiptId, result }) => saveResult(ctx, receiptId, result),
});

// TODO(release): remove devCreateParsed; it feeds a hand-written result so the flow runs without ANTHROPIC_API_KEY.
export const devCreateParsed = mutation({
  args: { fileId: v.id("_storage"), fileType, result: receiptResult },
  handler: async (ctx, { fileId, fileType, result }) => {
    if (process.env.ALLOW_DEMO_USER !== "true") throw new Error("receipts.devCreateParsed needs ALLOW_DEMO_USER=true");
    const userId = await getUserId(ctx);
    const receiptId = await ctx.db.insert("receipts", { userId, fileId, fileType, status: "parsing" });
    await saveResult(ctx, receiptId, result);
    return receiptId;
  },
});

async function saveResult(ctx: MutationCtx, receiptId: Id<"receipts">, result: Infer<typeof receiptResult>) {
  const receipt = await ctx.db.get(receiptId);
  if (!receipt) throw new Error("Receipt not found");
  if (!result.isReceipt) {
    await ctx.db.patch(receiptId, { status: "failed", error: "This file doesn't look like a grocery receipt." });
    return { items: 0 };
  }
  // Re-parsing replaces earlier drafts instead of adding to them.
  const stale = await ctx.db
    .query("items")
    .withIndex("by_receipt", (q) => q.eq("receiptId", receiptId))
    .collect();
  for (const item of stale) if (item.status === "draft") await ctx.db.delete(item._id);

  const offset = await utcOffsetFor(ctx, receipt.userId);
  const { purchasedAt, printedAt, implausible } = purchaseDate(result.purchasedAt, receipt._creationTime, offset);
  const foodIds: Id<"foods">[] = [];
  for (const line of result.lines) {
    const food = await resolveFood(ctx, line.foodName, line.newFood);
    if (food) foodIds.push(food._id);
    const loc = food?.defaultLocation ?? "fridge";
    const expiry = expiryFor(food, loc, purchasedAt);
    const weightGrams = line.weightGrams ?? food?.defaultWeightGrams;
    await ctx.db.insert("items", {
      userId: receipt.userId,
      receiptId,
      foodId: food?._id,
      name: line.displayName,
      quantity: line.quantity,
      unit: line.unit ?? undefined,
      priceCents: Math.round(line.priceCents),
      weightGrams: weightGrams ?? undefined,
      location: loc,
      purchasedAt,
      expiresAt: expiry?.expiresAt,
      expirySource: expiry?.expirySource,
      status: "draft",
    });
  }
  await ctx.db.patch(receiptId, {
    status: "parsed",
    error: undefined,
    storeName: result.storeName ?? undefined,
    purchasedAt: printedAt ?? undefined,
    totalCents: result.totalCents ?? undefined,
    reviewFlags: implausible ? ["implausible_date"] : undefined,
    verification: undefined,
  });
  await scheduleWebLookup(ctx, foodIds);
  return { items: result.lines.length };
}

// A foodName not in the table counts as unmatched; newFood rows get tips but never shelf-life ranges.
export async function resolveFood(
  ctx: MutationCtx,
  foodName: string | null,
  fresh: Infer<typeof newFood> | null,
): Promise<Doc<"foods"> | null> {
  if (foodName) {
    const match = await foodByName(ctx, foodName);
    if (match) return match;
  }
  if (!fresh) return null;
  const name = fresh.name.toLowerCase().trim();
  const existing = await foodByName(ctx, name);
  if (existing) return existing;
  const foodId = await ctx.db.insert("foods", {
    name,
    aliases: [],
    category: fresh.category,
    defaultLocation: fresh.defaultLocation,
    defaultWeightGrams: fresh.defaultWeightGrams ?? undefined,
    storageTip: { text: fresh.storageTip, source: "llm" },
    freshnessHint: { text: fresh.freshnessHint, source: "llm" },
    hasPrintedDate: fresh.hasPrintedDate,
  });
  return await ctx.db.get(foodId);
}

function foodByName(ctx: QueryCtx, name: string) {
  return ctx.db
    .query("foods")
    .withIndex("by_name", (q) => q.eq("name", name.toLowerCase().trim()))
    .unique();
}
