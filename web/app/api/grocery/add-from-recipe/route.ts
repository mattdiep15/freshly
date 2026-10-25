import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { devOnly } from "../../_lib/dev-only";

// ?recipe=pasta&names=garlic,parmesan
export async function GET(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const params = new URL(req.url).searchParams;
  const names = (params.get("names") ?? "").split(",").filter(Boolean);
  return Response.json(await fetchMutation(api.grocery.addFromRecipe, { recipeName: params.get("recipe") ?? "", names }));
}
