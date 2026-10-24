import { v } from "convex/values";
import { summarizeWaste } from "../lib/wasteStats";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { getUserId } from "./model/auth";
import { loadResolved, streakFor } from "./model/stats";

// No 0, O, 1, or I, so a code read aloud or off a screen is not mistyped.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const MAX_FRIENDS = 50;

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

async function profileFor(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

async function profileByCode(ctx: QueryCtx, code: string) {
  return await ctx.db
    .query("profiles")
    .withIndex("by_invite_code", (q) => q.eq("inviteCode", normalizeCode(code)))
    .unique();
}

async function friendshipRows(ctx: QueryCtx, userId: Id<"users">, friendId: Id<"users">) {
  const rows = [];
  for (const [a, b] of [[userId, friendId], [friendId, userId]]) {
    const row = await ctx.db
      .query("friendships")
      .withIndex("by_pair", (q) => q.eq("userId", a).eq("friendId", b))
      .unique();
    if (row) rows.push(row);
  }
  return rows;
}

// Creates the caller's code on first call, so it is a mutation.
export const inviteCode = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    const profile = await profileFor(ctx, userId);
    if (!profile) throw new Error("Profile not found");
    if (profile.inviteCode) return profile.inviteCode;
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
      if (await profileByCode(ctx, code)) continue;
      await ctx.db.patch(profile._id, { inviteCode: code });
      return code;
    }
    throw new Error("Could not create an invite code. Try again.");
  },
});

// Lets the invite link ask "add <name>?" before anything is written.
export const invitePreview = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getUserId(ctx);
    const profile = await profileByCode(ctx, code);
    if (!profile) return { status: "unknown" as const };
    if (profile.userId === userId) return { status: "self" as const };
    const friends = (await friendshipRows(ctx, userId, profile.userId)).length > 0;
    return { status: friends ? ("friends" as const) : ("ok" as const), name: profile.displayName };
  },
});

// Entering someone's code is their consent, so both rows are written at once.
export const add = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getUserId(ctx);
    const friend = await profileByCode(ctx, code);
    if (!friend) throw new Error("No one has that invite code");
    if (friend.userId === userId) throw new Error("That is your own invite code");
    if ((await friendshipRows(ctx, userId, friend.userId)).length > 0) {
      throw new Error(`You and ${friend.displayName} are already friends`);
    }
    for (const id of [userId, friend.userId]) {
      const count = (await ctx.db.query("friendships").withIndex("by_user", (q) => q.eq("userId", id)).take(MAX_FRIENDS)).length;
      if (count >= MAX_FRIENDS) throw new Error(`A friend list is full at ${MAX_FRIENDS}`);
    }
    await ctx.db.insert("friendships", { userId, friendId: friend.userId });
    await ctx.db.insert("friendships", { userId: friend.userId, friendId: userId });
    return { friendId: friend.userId, name: friend.displayName };
  },
});

export const remove = mutation({
  args: { friendId: v.id("users") },
  handler: async (ctx, { friendId }) => {
    const userId = await getUserId(ctx);
    const rows = await friendshipRows(ctx, userId, friendId);
    if (rows.length === 0) throw new Error("Not friends");
    for (const row of rows) await ctx.db.delete(row._id);
  },
});

// Friends see only these numbers and a display name, never items.
export const leaderboard = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    const now = Date.now();
    const friendships = await ctx.db
      .query("friendships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(MAX_FRIENDS);
    const rows = [];
    for (const id of [userId, ...friendships.map((f) => f.friendId)]) {
      const profile = await profileFor(ctx, id);
      const week = summarizeWaste(await loadResolved(ctx, id), "week", now);
      rows.push({
        userId: id,
        name: profile?.displayName ?? "friend",
        lbsWasted: Math.round(week.wastedLbs * 10) / 10,
        usedRate: week.usedRate,
        streakDays: await streakFor(ctx, id, now),
        isYou: id === userId,
      });
    }
    // Rank by used rate so a big household that logs everything is not beaten by someone who logs nothing.
    return rows.sort(
      (a, b) =>
        (b.usedRate ?? -1) - (a.usedRate ?? -1) || a.lbsWasted - b.lbsWasted || a.name.localeCompare(b.name),
    );
  },
});
