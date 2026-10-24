"use node";

import type Anthropic from "@anthropic-ai/sdk";
import { v, type Infer } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction } from "./_generated/server";
import {
  anthropicClient,
  askJson,
  MANUAL_SCHEMA,
  manualSystemPrompt,
  RECEIPT_SCHEMA,
  receiptSystemPrompt,
} from "./model/claude";
import type { newFood, receiptResult } from "./receipts";
import { location } from "./schema";

const MB = 1024 * 1024;
// The API caps each image at 5 MB after base64 encoding, which adds a third.
const MAX_IMAGE_BYTES = 3.75 * MB;
const MAX_PDF_BYTES = 20 * MB;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

async function fileBlock(blob: Blob, fileType: "image" | "pdf"): Promise<Anthropic.Beta.BetaContentBlockParam> {
  const mb = (blob.size / MB).toFixed(1);
  if (fileType === "pdf") {
    if (blob.size > MAX_PDF_BYTES) throw new Error(`PDF is ${mb} MB; the limit is ${MAX_PDF_BYTES / MB} MB.`);
    const data = Buffer.from(await blob.arrayBuffer()).toString("base64");
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  }
  const mediaType = IMAGE_TYPES.find((t) => t === blob.type);
  if (!mediaType) throw new Error(`Unsupported image type "${blob.type}". Upload a JPEG, PNG, GIF, or WebP.`);
  if (blob.size > MAX_IMAGE_BYTES) {
    throw new Error(`Photo is ${mb} MB; the limit is 3.75 MB. Downscale it to about 1600 px on the long edge.`);
  }
  const data = Buffer.from(await blob.arrayBuffer()).toString("base64");
  return { type: "image", source: { type: "base64", media_type: mediaType, data } };
}

export const parse = internalAction({
  args: { receiptId: v.id("receipts") },
  handler: async (ctx, { receiptId }) => {
    const input = await ctx.runQuery(internal.receipts.parseInput, { receiptId });
    if (!input) return;
    await ctx.runMutation(internal.receipts.setStatus, { receiptId, status: "parsing" });
    try {
      const blob = await ctx.storage.get(input.fileId);
      if (!blob) throw new Error("The uploaded file is missing from storage.");
      const block = await fileBlock(blob, input.fileType);
      const result = (await askJson(
        anthropicClient(),
        receiptSystemPrompt(input.foodNames),
        [block, { type: "text", text: "Read this receipt." }],
        RECEIPT_SCHEMA,
      )) as Infer<typeof receiptResult>;
      console.log(`receipt ${receiptId}: ${result.lines.length} lines`, result.lines.map((l) => `${l.displayName} ${l.priceCents}`));
      await ctx.runMutation(internal.receipts.saveParsed, { receiptId, result });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(internal.receipts.setStatus, { receiptId, status: "failed", error });
    }
  },
});

// Demo fallback when receipt parsing misbehaves: one typed name becomes one active item.
export const addManual = action({
  args: {
    name: v.string(),
    quantity: v.optional(v.number()),
    location: v.optional(location),
    priceCents: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<"items">> => {
    const name = args.name.trim();
    if (!name) throw new Error("Name is empty");
    const input = await ctx.runQuery(internal.itemEdits.manualInput, { name });
    let match: { foodName: string | null; newFood: Infer<typeof newFood> | null } = {
      foodName: input.exactMatch,
      newFood: null,
    };
    if (!input.exactMatch) {
      match = (await askJson(
        anthropicClient(),
        manualSystemPrompt(input.foodNames),
        [{ type: "text", text: name }],
        MANUAL_SCHEMA,
      )) as typeof match;
    }
    return await ctx.runMutation(internal.itemEdits.insertManual, { ...args, name, ...match });
  },
});
