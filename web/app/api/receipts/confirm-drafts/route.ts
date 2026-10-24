import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { devOnly } from "../../_lib/dev-only";

// remove is an optional comma-separated list of draft item ids to drop.
export async function GET(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const params = new URL(req.url).searchParams;
  const removeItemIds = (params.get("remove") ?? "").split(",").filter(Boolean) as Id<"items">[];
  const receiptId = (params.get("receiptId") ?? "") as Id<"receipts">;
  return Response.json(await fetchMutation(api.receipts.confirmDrafts, { receiptId, removeItemIds }));
}
