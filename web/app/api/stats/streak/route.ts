import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export async function GET() {
  return Response.json(await fetchQuery(api.stats.streak, {}));
}
