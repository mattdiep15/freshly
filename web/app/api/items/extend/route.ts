import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { devOnly } from "../../_lib/dev-only";

export async function GET(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const itemId = new URL(req.url).searchParams.get("id") as Id<"items">;
  return Response.json(await fetchMutation(api.items.extend, { itemId }));
}
