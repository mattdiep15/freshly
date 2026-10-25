import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const location = v.union(v.literal("fridge"), v.literal("freezer"), v.literal("pantry"));
export const shelfLifeSource = v.union(v.literal("fda_chart"), v.literal("foodkeeper"), v.literal("web"));
// ref points at the exact source row, e.g. "FDA chart 2018-03 > Fresh Poultry > Chicken or turkey, parts > ...";
// a web ref is the page URL, the basis, and the quoted sentence.
export const shelfLife = v.object({ min: v.number(), max: v.number(), source: shelfLifeSource, ref: v.string() });
// A web tip's ref is the page URL and the passage it was written from, quoted word for word.
export const storageTip = v.object({
  text: v.string(),
  source: v.union(v.literal("fda_chart"), v.literal("foodkeeper"), v.literal("web"), v.literal("llm")),
  ref: v.optional(v.string()),
});
export const freshnessHint = v.object({
  text: v.string(),
  source: v.union(v.literal("foodkeeper"), v.literal("web"), v.literal("llm")),
  ref: v.optional(v.string()),
});
// Mirrors ReviewFlag in lib/receiptCheck.ts.
export const reviewFlag = v.union(
  v.literal("implausible_date"),
  v.literal("store_mismatch"),
  v.literal("date_mismatch"),
  v.literal("total_mismatch"),
);
// Mirrors Recipe in lib/recipes.ts, plus a source link.
export const recipeStep = v.object({
  phase: v.union(v.literal("prep"), v.literal("cook"), v.literal("serve")),
  text: v.string(),
  timedMinutes: v.optional(v.number()),
  whisk: v.optional(v.boolean()),
});
export const recipe = v.object({
  id: v.string(),
  name: v.string(),
  ingredients: v.array(v.string()),
  minutes: v.number(),
  dish: v.union(v.literal("pot"), v.literal("pan"), v.literal("bowl")),
  cookTool: v.union(v.literal("pot"), v.literal("pan")),
  heat: v.string(),
  servings: v.number(),
  steps: v.array(recipeStep),
  sourceUrl: v.optional(v.string()), // absent for the static fallback recipes
});
export const itemStatus = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("expired"),
  v.literal("used"),
  v.literal("wasted"),
);

export const foodFields = {
  name: v.string(), // canonical, lowercase
  aliases: v.array(v.string()), // receipt-style names
  category: v.string(),
  defaultLocation: location,
  fridgeDays: v.optional(shelfLife),
  freezerDays: v.optional(shelfLife),
  pantryDays: v.optional(shelfLife),
  storageTip: v.optional(storageTip),
  freshnessHint: v.optional(freshnessHint),
  defaultWeightGrams: v.optional(v.number()), // rough estimate for lbs wasted, not a safety claim
  hasPrintedDate: v.optional(v.boolean()), // processed product sold with a best-by date; the UI asks for it
  webLookupAt: v.optional(v.number()), // set when shelfLifeWeb has searched StillTasty for this food, so it searches once
};

export default defineSchema({
  ...authTables,

  profiles: defineTable({
    userId: v.id("users"),
    displayName: v.string(),
    utcOffsetMinutes: v.number(), // set by the client on sign-in, used for digest timing
    digestHour: v.number(), // local hour for the daily reminder, default 9
    wastedFraction: v.optional(v.number()), // share of a tossed item counted as wasted; DEFAULT_WASTED_FRACTION when absent
    alwaysAskSpoiled: v.optional(v.boolean()), // show the "looks spoiled?" card even when there are no days left to extend
    inviteCode: v.optional(v.string()), // 6 characters, set the first time the user opens the friends view
    hideDollarsFromFriends: v.optional(v.boolean()), // absent shares weekly $ wasted on the leaderboard
    hideWebRecipes: v.optional(v.boolean()), // absent shows grounded web recipes and runs the daily search
  })
    .index("by_user", ["userId"])
    .index("by_invite_code", ["inviteCode"]),

  foods: defineTable(foodFields).index("by_name", ["name"]),

  receipts: defineTable({
    userId: v.id("users"),
    fileId: v.id("_storage"),
    fileType: v.union(v.literal("image"), v.literal("pdf")),
    status: v.union(v.literal("uploaded"), v.literal("parsing"), v.literal("parsed"), v.literal("failed")),
    storeName: v.optional(v.string()),
    purchasedAt: v.optional(v.number()),
    totalCents: v.optional(v.number()),
    error: v.optional(v.string()),
    // Header fields the review screen should ask the user to confirm.
    reviewFlags: v.optional(v.array(reviewFlag)),
    // Gemini's second reading of the header; absent until receiptsNode.verify runs.
    verification: v.optional(
      v.object({
        status: v.union(v.literal("done"), v.literal("skipped")),
        storeName: v.optional(v.string()),
        purchasedAt: v.optional(v.string()),
        totalCents: v.optional(v.number()),
        error: v.optional(v.string()),
      }),
    ),
  }).index("by_user", ["userId"]),

  items: defineTable({
    userId: v.id("users"),
    receiptId: v.optional(v.id("receipts")),
    foodId: v.optional(v.id("foods")),
    name: v.string(),
    quantity: v.number(),
    unit: v.optional(v.string()),
    priceCents: v.optional(v.number()),
    weightGrams: v.optional(v.number()),
    location,
    purchasedAt: v.number(),
    expiresAt: v.optional(v.number()), // absent when no sourced shelf life exists and the user has not set one
    expirySource: v.optional(v.union(v.literal("fda_chart"), v.literal("foodkeeper"), v.literal("web"), v.literal("user"))),
    status: itemStatus,
    fractionWasted: v.optional(v.number()), // 0..1, set when status becomes used or wasted
    resolvedAt: v.optional(v.number()),
  })
    .index("by_user_status", ["userId", "status", "expiresAt"])
    .index("by_status_expires", ["status", "expiresAt"])
    .index("by_receipt", ["receiptId"]),

  // Shape from docs/exec-plans/p2-01-schema.md.
  groceryItems: defineTable({
    userId: v.id("users"),
    name: v.string(),
    foodId: v.optional(v.id("foods")), // set when the name matches a food, so a scanned receipt can check it off
    checkedAt: v.optional(v.number()), // absent while unchecked
    checkedBy: v.optional(v.union(v.literal("user"), v.literal("receipt"))),
    recipeName: v.optional(v.string()), // set when added from a recipe's missing ingredients
  }).index("by_user", ["userId"]),

  // Shape from docs/exec-plans/p2-01-schema.md. One row per direction, so "my friends" is one index read.
  friendships: defineTable({
    userId: v.id("users"),
    friendId: v.id("users"),
  })
    .index("by_user", ["userId"])
    .index("by_pair", ["userId", "friendId"]),

  foodFamiliarity: defineTable({
    userId: v.id("users"),
    foodId: v.id("foods"),
    timesAdded: v.number(),
    tipViews: v.number(),
  }).index("by_user_food", ["userId", "foodId"]),

  pushSubscriptions: defineTable({
    userId: v.id("users"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_endpoint", ["endpoint"]),

  notifications: defineTable({
    userId: v.id("users"),
    kind: v.literal("digest"),
    dateKey: v.string(), // "2026-10-24" in the user's local time
    title: v.string(),
    body: v.string(),
    itemIds: v.array(v.id("items")),
    undatedCount: v.optional(v.number()), // set when the digest nudged about undated items, for the weekly limit
    readAt: v.optional(v.number()),
  }).index("by_user_date", ["userId", "dateKey"]),

  recipeSuggestions: defineTable({
    userId: v.id("users"),
    dateKey: v.string(), // local date, like notifications.dateKey
    ingredients: v.array(v.string()), // the use-soon names the search used
    status: v.union(v.literal("pending"), v.literal("ready"), v.literal("failed")),
    recipes: v.array(recipe),
    error: v.optional(v.string()),
  }).index("by_user_date", ["userId", "dateKey"]),
});
