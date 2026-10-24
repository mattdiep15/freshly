import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { devOnly } from "../../_lib/dev-only";

export async function GET(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const params = new URL(req.url).searchParams;
  const fraction = params.get("fractionWasted");
  return Response.json(
    await fetchMutation(api.items.resolve, {
      itemId: params.get("id") as Id<"items">,
      outcome: params.get("outcome") as "used" | "wasted",
      fractionWasted: fraction === null ? undefined : Number(fraction),
    }),
  );
}
