import Anthropic from "@anthropic-ai/sdk";

// RECEIPT_MODEL overrides the model per deployment without a code change.
export const receiptModel = () => process.env.RECEIPT_MODEL ?? "claude-sonnet-5-5";

export function anthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set on this Convex deployment.");
  return new Anthropic();
}

const nullable = (schema: object) => ({ anyOf: [schema, { type: "null" }] });

const NEW_FOOD_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    category: { type: "string" },
    defaultLocation: { type: "string", enum: ["fridge", "freezer", "pantry"] },
    defaultWeightGrams: nullable({ type: "number" }),
    storageTip: { type: "string" },
    freshnessHint: { type: "string" },
    hasPrintedDate: { type: "boolean" },
  },
  required: ["name", "category", "defaultLocation", "defaultWeightGrams", "storageTip", "freshnessHint", "hasPrintedDate"],
  additionalProperties: false,
};

const LINE_SCHEMA = {
  type: "object",
  properties: {
    rawText: { type: "string" },
    displayName: { type: "string" },
    quantity: { type: "number" },
    unit: nullable({ type: "string" }),
    priceCents: { type: "integer" },
    weightGrams: nullable({ type: "number" }),
    foodName: nullable({ type: "string" }),
    newFood: nullable(NEW_FOOD_SCHEMA),
  },
  required: ["rawText", "displayName", "quantity", "unit", "priceCents", "weightGrams", "foodName", "newFood"],
  additionalProperties: false,
};

// The record_receipt payload; it has no shelf-life fields, so the model cannot supply days.
export const RECEIPT_SCHEMA = {
  type: "object",
  properties: {
    isReceipt: { type: "boolean" },
    storeName: nullable({ type: "string" }),
    purchasedAt: nullable({ type: "string", format: "date" }),
    totalCents: nullable({ type: "integer" }),
    lines: { type: "array", items: LINE_SCHEMA },
  },
  required: ["isReceipt", "storeName", "purchasedAt", "totalCents", "lines"],
  additionalProperties: false,
};

export const MANUAL_SCHEMA = {
  type: "object",
  properties: { foodName: nullable({ type: "string" }), newFood: nullable(NEW_FOOD_SCHEMA) },
  required: ["foodName", "newFood"],
  additionalProperties: false,
};

export const TIPS_SCHEMA = {
  type: "object",
  properties: {
    tips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          number: { type: "integer" },
          storageTip: { type: "string" },
          freshnessHint: { type: "string" },
          hasPrintedDate: { type: "boolean" },
        },
        required: ["number", "storageTip", "freshnessHint", "hasPrintedDate"],
        additionalProperties: false,
      },
    },
  },
  required: ["tips"],
  additionalProperties: false,
};

const PRINTED_DATE_RULE = `hasPrintedDate is true for processed or manufactured products normally sold with a printed best-by or use-by date: snacks, drinks, sauces, cereal, baking mixes, packaged bread, cheese, yogurt, butter, frozen meals. It is false for raw produce, raw meat, poultry, and fish, and eggs.`;

const MATCHING_RULES = `Matching each food to the foods list:
- foodName must be copied exactly from the foods list below, or be null. Pick the closest storage category, e.g. "47355 GROUND BEEF" -> "ground beef", "KS SOCKEYE" -> "fatty fish", "BIMBO BUNS" -> "commercial bread products, including pan breads, flat breads, rolls, and buns".
- When nothing in the list fits, set foodName to null and fill newFood: a short lowercase generic name, a category, where it is normally stored, a rough package weight in grams, a one-sentence storage tip, and a one-sentence sign that it has gone bad.
- When foodName is set, newFood is null.
- ${PRINTED_DATE_RULE}
- Never state how many days a food lasts. Shelf life comes from a separate sourced table.`;

export function receiptSystemPrompt(foodNames: string[]): string {
  return `You read grocery receipts for Freshly, an app that tracks what is in a student's fridge. Return the purchased food lines as JSON.

Line rules:
- Skip tax, subtotal, total, payment, change, card, and member lines, CRV or bottle deposits (e.g. "CA REDEMP VA"), bags, and alcohol (beer, wine, spirits, hard seltzer, soju, canned cocktails).
- Skip anything that is not food or drink.
- A VOID line cancels the matching earlier line. Drop both, and drop any discount attached to the voided item.
- A discount line ("/ <item number>" or "/<item number>" with a negative amount) reduces that item's price. Report priceCents after the discount and do not emit the discount as a line.
- Quantity lines ("2 @ $3.99") set quantity; priceCents is the line total.
- Keep repeated lines as separate entries.
- Phone photos are often tilted, so a price can sit slightly above or below its name. Use the item order and the totals to pair them.
- Never copy member numbers, card digits, cashier names, or other personal details into any field.
- displayName is a short readable name in sentence case, e.g. "KS SOCKEYE" -> "Sockeye salmon".
- purchasedAt is the date printed on the receipt as YYYY-MM-DD, or null. storeName is the store's name, or null when the header is cut off.
- If the file is not a grocery or food receipt, set isReceipt to false and return no lines.

${MATCHING_RULES}

Foods list (one per line):
${foodNames.join("\n")}`;
}

export function manualSystemPrompt(foodNames: string[]): string {
  return `You match one food name typed by a student to Freshly's foods list, for tracking what is in their fridge.

${MATCHING_RULES}

Foods list (one per line):
${foodNames.join("\n")}`;
}

export const TIPS_SYSTEM_PROMPT = `You write short storage guidance for Freshly, an app that tracks what is in a student's fridge. For each food given, return:
- storageTip: one sentence on how to store it to keep it fresh.
- freshnessHint: one sentence on how to tell it has gone bad (look, smell, texture).
- ${PRINTED_DATE_RULE}
Never state how many days, weeks, or months a food lasts; shelf life comes from a separate sourced table. Return one entry per food, with the number it was given.`;

// Structured output instead of a forced tool call: Sonnet 5.5 rejects forced tool_choice.
export async function askJson(
  client: Anthropic,
  system: string,
  content: Anthropic.Beta.BetaContentBlockParam[],
  schema: Record<string, unknown>,
): Promise<unknown> {
  const response = await client.beta.messages.create({
    model: receiptModel(),
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
    output_config: { format: { type: "json_schema", schema } },
  });
  if (response.stop_reason === "refusal") throw new Error("The model declined to read this file.");
  if (response.stop_reason === "max_tokens") throw new Error("The model's answer was cut off (max_tokens).");
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("The model returned no JSON.");
  return JSON.parse(text.text);
}
