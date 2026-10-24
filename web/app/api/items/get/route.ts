import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export async function GET(req: Request) {
  const itemId = new URL(req.url).searchParams.get("id") as Id<"items">;
  return Response.json(await fetchQuery(api.items.get, { itemId }));
}
