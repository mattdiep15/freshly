import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { devOnly } from "../../_lib/dev-only";

export async function GET(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const name = new URL(req.url).searchParams.get("name") ?? "";
  return Response.json({ entryId: await fetchMutation(api.grocery.add, { name }) });
}
