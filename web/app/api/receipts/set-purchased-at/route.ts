import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { devOnly } from "../../_lib/dev-only";

// date is the purchase day as printed (2026-10-15); the mutation places it in the user's timezone.
export async function GET(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const params = new URL(req.url).searchParams;
  const date = params.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  const receiptId = (params.get("id") ?? "") as Id<"receipts">;
  return Response.json(await fetchMutation(api.receipts.setPurchasedAt, { receiptId, date }));
}
