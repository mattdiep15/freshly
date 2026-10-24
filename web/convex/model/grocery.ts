import { entriesToCheckOff } from "../../lib/grocery";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

// A list is a few dozen rows; the cap keeps one read bounded.
export const MAX_GROCERY_ROWS = 200;

export async function groceryEntries(ctx: MutationCtx, userId: Id<"users">) {
  return await ctx.db
    .query("groceryItems")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(MAX_GROCERY_ROWS);
}

// Called after a confirmed receipt or a manual add; both mean the user bought it.
export async function checkOffGroceries(ctx: MutationCtx, userId: Id<"users">, items: Pick<Doc<"items">, "name" | "foodId">[]) {
  const ids = entriesToCheckOff(await groceryEntries(ctx, userId), items);
  const checkedAt = Date.now();
  for (const id of ids) await ctx.db.patch(id, { checkedAt, checkedBy: "receipt" });
  return ids.length;
}
