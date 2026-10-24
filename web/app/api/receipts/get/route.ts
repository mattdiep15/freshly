import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  return Response.json(await fetchQuery(api.receipts.get, { receiptId: id as Id<"receipts"> }));
}
