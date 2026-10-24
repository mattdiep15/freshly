import { fetchQuery } from "convex/nextjs";
import { connection } from "next/server";
import { api } from "@/convex/_generated/api";

export async function GET() {
  await connection();
  return Response.json(await fetchQuery(api.notifications.list, {}));
}
