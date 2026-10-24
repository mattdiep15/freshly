import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { devOnly } from "../../_lib/dev-only";

const LOCATIONS = ["fridge", "freezer", "pantry"] as const;

// expiresAt takes a date (2026-11-01) or a full ISO timestamp.
export async function GET(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const params = new URL(req.url).searchParams;
  const expires = params.get("expiresAt");
  const expiresAt = expires ? Date.parse(expires) : undefined;
  if (Number.isNaN(expiresAt)) return Response.json({ error: "expiresAt is not a date" }, { status: 400 });
  const item = await fetchMutation(api.itemEdits.update, {
    itemId: (params.get("id") ?? "") as Id<"items">,
    name: params.get("name") ?? undefined,
    quantity: params.has("quantity") ? Number(params.get("quantity")) : undefined,
    location: LOCATIONS.find((l) => l === params.get("location")),
    expiresAt,
  });
  return Response.json(item);
}
