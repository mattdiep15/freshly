import { askClaude } from "./claude";
import { askGemini } from "./gemini";

// A provider-neutral message part; file data is base64.
export type Part = { type: "text"; text: string } | { type: "file"; mimeType: string; data: string };

// LLM_PROVIDER picks the main model per deployment; Claude is the default and Gemini verifies receipt headers.
export function askJson(system: string, parts: Part[], schema: Record<string, unknown>): Promise<unknown> {
  return process.env.LLM_PROVIDER === "gemini" ? askGemini(system, parts, schema) : askClaude(system, parts, schema);
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

// The verifier's reading: only the header fields, so a second model can check the main parse.
export const HEADER_SCHEMA = {
  type: "object",
  properties: {
    storeName: nullable({ type: "string" }),
    purchasedAt: nullable({ type: "string", format: "date" }),
    totalCents: nullable({ type: "integer" }),
  },
  required: ["storeName", "purchasedAt", "totalCents"],
  additionalProperties: false,
};

export const HEADER_SYSTEM_PROMPT = `You check grocery receipts for Freshly, an app that tracks what is in a student's fridge. Read only these fields from the receipt:
- storeName: the store's name, or null when the header is cut off.
- purchasedAt: the purchase date printed on the receipt as YYYY-MM-DD, or null. Read the year digit by digit; do not guess it.
- totalCents: the final total paid, in cents, or null.
Never copy member numbers, card digits, cashier names, or other personal details.`;

// Mirrors WebEntry in lib/webShelfLife.ts.
export const WEB_SHELF_LIFE_SCHEMA = {
  type: "object",
  properties: {
    entries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          location: { type: "string", enum: ["fridge", "freezer", "pantry"] },
          basis: { type: "string", enum: ["unopened", "after_opening", "past_printed_date", "from_purchase"] },
          minDays: { type: "integer" },
          maxDays: { type: "integer" },
          url: { type: "string" },
          quote: { type: "string" },
        },
        required: ["location", "basis", "minDays", "maxDays", "url", "quote"],
        additionalProperties: false,
      },
    },
  },
  required: ["entries"],
  additionalProperties: false,
};

export function webShelfLifeSystemPrompt(foodName: string): string {
  return `You extract shelf-life figures for "${foodName}" from web pages for Freshly, an app that tracks what is in a student's fridge. Each page starts with a line "URL: <url>".

For every shelf-life figure a page states for this food, return one entry. Skip pages and figures about a different food or a different form of it (for example dry mix when the food is prepared pudding).
- location: where it is stored (fridge, freezer, or pantry; room temperature and cupboard count as pantry).
- basis: unopened (sealed, counted from purchase), after_opening, past_printed_date (how long past the best-by or use-by date), or from_purchase.
- minDays and maxDays: the range in days (1 week = 7, 1 month = 30, 1 year = 365). A single figure has minDays equal to maxDays.
- url: the page's URL exactly as given.
- quote: the passage the figure comes from, copied word for word from the page and long enough to show the food and the figure. On a table-style page, copy the heading, the storage location, and the figure in the order they appear, leaving out image and link markup.

Only use figures the pages state. Never estimate or fill in a figure yourself. Return no entries when the pages give none for this food.`;
}

// Mirrors WebRecipe in lib/recipeWeb.ts; the id is assigned after grounding.
export const RECIPE_SCHEMA = {
  type: "object",
  properties: {
    recipes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          ingredients: { type: "array", items: { type: "string" } },
          minutes: { type: "integer" },
          dish: { type: "string", enum: ["pot", "pan", "bowl"] },
          cookTool: { type: "string", enum: ["pot", "pan"] },
          heat: { type: "string" },
          servings: { type: "integer" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                phase: { type: "string", enum: ["prep", "cook", "serve"] },
                text: { type: "string" },
                timedMinutes: nullable({ type: "integer" }),
              },
              required: ["phase", "text", "timedMinutes"],
              additionalProperties: false,
            },
          },
          sourceUrl: { type: "string" },
        },
        required: ["name", "ingredients", "minutes", "dish", "cookTool", "heat", "servings", "steps", "sourceUrl"],
        additionalProperties: false,
      },
    },
  },
  required: ["recipes"],
  additionalProperties: false,
};

export function recipeSystemPrompt(ingredients: string[]): string {
  return `You pick recipes for Freshly, an app that helps a student cook food from their fridge before it goes bad. The student wants to use up: ${ingredients.join(", ")}. Each web page below starts with a line "URL: <url>".

Return up to 3 recipes that use as many of those ingredients as possible.
- Use only recipes that appear on the given pages. Never invent a recipe or combine two pages into one.
- sourceUrl: the URL of the page the recipe is on, copied exactly as given.
- name: the recipe's name in lowercase.
- ingredients: every ingredient as one or two generic lowercase words, like "chicken", "spinach", "greek yogurt", "olive oil". No amounts, brands, or preparation notes.
- minutes: total time in minutes. servings: how many people it feeds.
- dish: what it is served in (pot for soups and stews, pan for skillet dishes and bakes, bowl for salads and bowls). cookTool: pot or pan, whichever the cooking mostly uses. heat: "low", "medium", "high", or "none".
- steps: write the method in your own short words, one sentence per step, at most 6 steps. Each step has a phase: prep (washing, cutting, mixing), cook (anything on heat or in the oven), or serve (plating and finishing), in that order. Do not copy the page's wording.
- timedMinutes: the minutes the page gives for that step, or null when the page gives no time for it.

Return no recipes when no page has a recipe that uses any of the ingredients.`;
}

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

