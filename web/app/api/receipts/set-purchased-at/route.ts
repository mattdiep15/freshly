import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { devOnly } from "../../_lib/dev-only";

// date takes a date (2026-10-15) or a full ISO timestamp.
export async function GET(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const params = new URL(req.url).searchParams;
  const purchasedAt = Date.parse(params.get("date") ?? "");
  if (Number.isNaN(purchasedAt)) return Response.json({ error: "date is not a date" }, { status: 400 });
  const receiptId = (params.get("id") ?? "") as Id<"receipts">;
  return Response.json(await fetchMutation(api.receipts.setPurchasedAt, { receiptId, purchasedAt }));
}
