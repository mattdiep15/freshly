import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export async function GET(req: Request) {
  const days = Number(new URL(req.url).searchParams.get("days") ?? 7);
  return Response.json(await fetchQuery(api.items.useSoon, { days }));
}
