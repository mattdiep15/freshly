import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code") ?? "";
  return Response.json(await fetchQuery(api.friends.invitePreview, { code }));
}
