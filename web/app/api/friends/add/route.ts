import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { devOnly } from "../../_lib/dev-only";

export async function GET(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const code = new URL(req.url).searchParams.get("code") ?? "";
  return Response.json(await fetchMutation(api.friends.add, { code }));
}
