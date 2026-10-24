import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get("status") ?? undefined;
  return Response.json(await fetchQuery(api.items.list, { status: status as Doc<"items">["status"] | undefined }));
}
