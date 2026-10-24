import { fetchAction } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { devOnly } from "../../_lib/dev-only";

const LOCATIONS = ["fridge", "freezer", "pantry"] as const;

export async function GET(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const params = new URL(req.url).searchParams;
  const num = (key: string) => (params.has(key) ? Number(params.get(key)) : undefined);
  const location = LOCATIONS.find((l) => l === params.get("location"));
  const itemId = await fetchAction(api.receiptsNode.addManual, {
    name: params.get("name") ?? "",
    quantity: num("quantity"),
    location,
    priceCents: num("priceCents"),
  });
  return Response.json({ itemId });
}
