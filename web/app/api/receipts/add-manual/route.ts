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
  const expires = params.get("expiresAt");
  const expiresAt = expires ? Date.parse(expires) : undefined;
  if (Number.isNaN(expiresAt)) return Response.json({ error: "expiresAt is not a date" }, { status: 400 });
  const itemId = await fetchAction(api.receiptsNode.addManual, {
    name: params.get("name") ?? "",
    quantity: num("quantity"),
    location,
    priceCents: num("priceCents"),
    expiresAt,
  });
  return Response.json({ itemId });
}
