import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { devOnly } from "../../_lib/dev-only";

export async function GET(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const entryId = (new URL(req.url).searchParams.get("id") ?? "") as Id<"groceryItems">;
  return Response.json((await fetchMutation(api.grocery.toggle, { entryId })) ?? { entryId, removed: true });
}
