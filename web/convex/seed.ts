import { periodStart } from "../lib/wasteStats";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { DEMO_EMAIL } from "./model/auth";
import { importReferenceFoods } from "./model/foods";

const DAY = 24 * 60 * 60 * 1000;

type Loc = "fridge" | "freezer" | "pantry";
type SeedItem = {
  food: string; // foods.name
  name: string;
  location: Loc;
  priceCents: number;
  weightGrams: number;
  quantity?: number;
  unit?: string;
} & (
  | { status: "active" | "expired"; daysLeft: number }
  | { status: "active"; undated: true }
  | { status: "used" | "wasted"; daysLeft: number; resolvedDaysAgo: number; fractionWasted: number }
);

// Expiry dates come from the sourced range; purchase dates are back-solved so each item lands where the demo needs it.
const ITEMS: SeedItem[] = [
  // Swipe cards waiting for a decision.
  { food: "spinach", name: "Baby spinach", location: "fridge", priceCents: 399, weightGrams: 283, status: "expired", daysLeft: -1 },
  { food: "ground beef", name: "Ground beef", location: "fridge", priceCents: 1099, weightGrams: 907, status: "expired", daysLeft: -2 },
  { food: "strawberries", name: "Strawberries", location: "fridge", priceCents: 499, weightGrams: 454, status: "expired", daysLeft: -1 },
  // Use-soon list: 1, 3, and 7 days left.
  { food: "chicken breast", name: "Chicken breast", location: "fridge", priceCents: 1299, weightGrams: 1361, status: "active", daysLeft: 1 },
  { food: "mushrooms", name: "Cremini mushrooms", location: "fridge", priceCents: 349, weightGrams: 227, status: "active", daysLeft: 3 },
  { food: "eggs", name: "Eggs", location: "fridge", priceCents: 599, weightGrams: 680, quantity: 12, status: "active", daysLeft: 7 },
  // Fresh.
  { food: "apples", name: "Honeycrisp apples", location: "fridge", priceCents: 699, weightGrams: 1361, status: "active", daysLeft: 25 },
  { food: "cheese, hard such as cheddar, swiss, block parmesan", name: "Cheddar cheese", location: "fridge", priceCents: 649, weightGrams: 454, status: "active", daysLeft: 150 },
  // No sourced fridge range for milk, so no date until the user sets one.
  { food: "milk", name: "Whole milk", location: "fridge", priceCents: 459, weightGrams: 3785, quantity: 1, unit: "gal", status: "active", undated: true },
  // Resolved over the past two weeks, so stats are not zero.
  { food: "bananas", name: "Bananas", location: "fridge", priceCents: 149, weightGrams: 900, status: "wasted", daysLeft: -12, resolvedDaysAgo: 11, fractionWasted: 1 },
  { food: "lettuce", name: "Romaine hearts", location: "fridge", priceCents: 349, weightGrams: 510, status: "used", daysLeft: -9, resolvedDaysAgo: 10, fractionWasted: 0 },
  { food: "yogurt", name: "Greek yogurt", location: "fridge", priceCents: 599, weightGrams: 907, status: "wasted", daysLeft: -6, resolvedDaysAgo: 5, fractionWasted: 0.5 },
  { food: "hot dogs", name: "Hot dogs", location: "fridge", priceCents: 549, weightGrams: 454, status: "used", daysLeft: -3, resolvedDaysAgo: 8, fractionWasted: 0 },
  { food: "cottage cheese", name: "Cottage cheese", location: "fridge", priceCents: 429, weightGrams: 680, status: "wasted", daysLeft: -4, resolvedDaysAgo: 3, fractionWasted: 1 },
  { food: "fatty fish", name: "Salmon fillet", location: "fridge", priceCents: 1499, weightGrams: 680, status: "used", daysLeft: -7, resolvedDaysAgo: 8, fractionWasted: 0 },
  { food: "rotisserie chicken", name: "Rotisserie chicken", location: "fridge", priceCents: 499, weightGrams: 1300, status: "used", daysLeft: -2, resolvedDaysAgo: 4, fractionWasted: 0 },
  { food: "commercial bread products, including pan breads, flat breads, rolls, and buns", name: "Sourdough bread", location: "pantry", priceCents: 599, weightGrams: 680, status: "wasted", daysLeft: -1, resolvedDaysAgo: 1, fractionWasted: 0.25 },
];

// Resets the demo user's fridge; safe to run before every demo.
export async function seedDemo(ctx: MutationCtx) {
  const foodCount = (await ctx.db.query("foods").take(1)).length;
  const reference = foodCount === 0 ? await importReferenceFoods(ctx) : null;

  let user = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", DEMO_EMAIL))
    .unique();
  const userId = user?._id ?? (await ctx.db.insert("users", { name: "Demo Student", email: DEMO_EMAIL }));
  user ??= await ctx.db.get(userId);

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  const profileFields = { userId, displayName: "Demo Student", utcOffsetMinutes: -420, digestHour: 9 };
  // Patch, not replace, so the demo settings survive a reset.
  if (profile) await ctx.db.patch(profile._id, profileFields);
  else await ctx.db.insert("profiles", profileFields);

  const stale = [
    ...(await ctx.db.query("items").withIndex("by_user_status", (q) => q.eq("userId", userId)).collect()),
    ...(await ctx.db.query("notifications").withIndex("by_user_date", (q) => q.eq("userId", userId)).collect()),
    ...(await ctx.db.query("foodFamiliarity").withIndex("by_user_food", (q) => q.eq("userId", userId)).collect()),
  ];
  for (const row of stale) await ctx.db.delete(row._id);
  for (const receipt of await ctx.db.query("receipts").withIndex("by_user", (q) => q.eq("userId", userId)).collect()) {
    await ctx.storage.delete(receipt.fileId);
    await ctx.db.delete(receipt._id);
  }

  const now = Date.now();
  for (const seed of ITEMS) {
    const food = await ctx.db
      .query("foods")
      .withIndex("by_name", (q) => q.eq("name", seed.food))
      .unique();
    if (!food) throw new Error(`Seed food missing from reference data: ${seed.food}`);
    const base = {
      userId,
      foodId: food._id,
      name: seed.name,
      quantity: seed.quantity ?? 1,
      unit: seed.unit,
      priceCents: seed.priceCents,
      weightGrams: seed.weightGrams,
      location: seed.location,
      status: seed.status,
    };
    if ("undated" in seed) {
      await ctx.db.insert("items", { ...base, purchasedAt: now - 2 * DAY });
      continue;
    }
    const range = rangeFor(food, seed.location);
    const expiresAt = now + seed.daysLeft * DAY;
    const dated = { ...base, expiresAt, expirySource: range.source, purchasedAt: expiresAt - range.min * DAY };
    if ("resolvedDaysAgo" in seed) {
      await ctx.db.insert("items", {
        ...dated,
        fractionWasted: seed.fractionWasted,
        resolvedAt: now - seed.resolvedDaysAgo * DAY,
      });
    } else {
      await ctx.db.insert("items", dated);
    }
  }
  await seedGrocery(ctx, userId);
  await seedFriends(ctx, userId, now);
  return { userId, email: user?.email, items: ITEMS.length, reference };
}

// p2-02's demo list: spinach matches a food, so a scan or manual add of spinach checks it off.
async function seedGrocery(ctx: MutationCtx, userId: Id<"users">) {
  for (const entry of await ctx.db.query("groceryItems").withIndex("by_user", (q) => q.eq("userId", userId)).collect()) {
    await ctx.db.delete(entry._id);
  }
  for (const name of ["spinach", "oat milk", "bananas"]) {
    const food = await ctx.db
      .query("foods")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();
    await ctx.db.insert("groceryItems", { userId, name, foodId: food?._id });
  }
}

// p2-03's friends. The leaderboard ranks calendar weeks, so this week's items are placed at a share of the week
// so far (0 = Monday 00:00 local, 1 = now) and land in the current week on any day. Older tosses set long streaks.
// Leaderboard order by weekly used rate: maya, theo, dev, you, nina.
type FriendItem = { name: string; grams: number; wasted?: true } & ({ daysAgo: number } | { weekShare: number });
const FRIENDS: { name: string; code: string; items: FriendItem[] }[] = [
  {
    name: "maya",
    code: "MAYA42",
    items: [
      { name: "Kale", grams: 90, daysAgo: 18, wasted: true },
      ...[0.2, 0.4, 0.6, 0.8, 0.95].map((weekShare) => ({ name: "Carrots", grams: 450, weekShare })),
    ],
  },
  {
    name: "theo",
    code: "THEX27",
    items: [
      { name: "Tortillas", grams: 320, daysAgo: 9, wasted: true },
      { name: "Tofu", grams: 400, weekShare: 0.5 },
      { name: "Rice", grams: 900, weekShare: 0.9 },
    ],
  },
  {
    name: "dev",
    code: "DEVV58",
    items: [
      { name: "Cilantro", grams: 500, weekShare: 0.1, wasted: true },
      ...[0.3, 0.6, 0.9].map((weekShare) => ({ name: "Pasta", grams: 450, weekShare })),
    ],
  },
  {
    name: "nina",
    code: "NINA36",
    items: [
      { name: "Avocados", grams: 150, weekShare: 0.1, wasted: true },
      { name: "Berries", grams: 150, weekShare: 0.2, wasted: true },
      { name: "Bagels", grams: 175, weekShare: 0.3, wasted: true },
      { name: "Hummus", grams: 160, weekShare: 0.4, wasted: true },
      { name: "Oats", grams: 500, weekShare: 0.8 },
    ],
  },
];

const FRIEND_UTC_OFFSET = -420;

async function seedFriends(ctx: MutationCtx, demoId: Id<"users">, now: number) {
  const weekStart = periodStart("week", now, FRIEND_UTC_OFFSET);
  for (const row of await ctx.db.query("friendships").withIndex("by_user", (q) => q.eq("userId", demoId)).collect()) {
    await ctx.db.delete(row._id);
  }
  for (const friend of FRIENDS) {
    const email = `${friend.name}@freshly.test`;
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    const friendId = user?._id ?? (await ctx.db.insert("users", { name: friend.name, email }));
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", friendId))
      .unique();
    const profileFields = { userId: friendId, displayName: friend.name, utcOffsetMinutes: FRIEND_UTC_OFFSET, digestHour: 9, inviteCode: friend.code };
    if (profile) await ctx.db.patch(profile._id, profileFields);
    else await ctx.db.insert("profiles", profileFields);

    const stale = [
      ...(await ctx.db.query("items").withIndex("by_user_status", (q) => q.eq("userId", friendId)).collect()),
      ...(await ctx.db.query("friendships").withIndex("by_user", (q) => q.eq("userId", friendId)).collect()),
    ];
    for (const row of stale) await ctx.db.delete(row._id);
    await ctx.db.insert("friendships", { userId: demoId, friendId });
    await ctx.db.insert("friendships", { userId: friendId, friendId: demoId });

    // No foodId or expiry: these rows only feed the friend's weekly numbers and streak.
    for (const item of friend.items) {
      await ctx.db.insert("items", {
        userId: friendId,
        name: item.name,
        quantity: 1,
        weightGrams: item.grams,
        location: "fridge",
        purchasedAt: now - 30 * DAY,
        status: item.wasted ? "wasted" : "used",
        fractionWasted: item.wasted ? 1 : 0,
        resolvedAt: "daysAgo" in item ? now - item.daysAgo * DAY : weekStart + item.weekShare * (now - weekStart),
      });
    }
  }
}

function rangeFor(food: Doc<"foods">, location: Loc) {
  const range = { fridge: food.fridgeDays, freezer: food.freezerDays, pantry: food.pantryDays }[location];
  if (!range) throw new Error(`Seed food has no sourced ${location} range: ${food.name}`);
  return range;
}

export const demo = internalMutation({
  args: {},
  handler: async (ctx) => seedDemo(ctx),
});
