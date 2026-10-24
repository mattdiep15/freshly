import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export async function GET(req: Request) {
  const range = new URL(req.url).searchParams.get("range") ?? undefined;
  return Response.json(await fetchQuery(api.stats.summary, { range: range as "week" | "month" | "all" | undefined }));
}
