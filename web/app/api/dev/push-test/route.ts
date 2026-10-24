import { fetchAction } from "convex/nextjs";
import { connection } from "next/server";
import { api } from "@/convex/_generated/api";
import { devOnly } from "../../_lib/dev-only";

export async function GET() {
  await connection();
  const blocked = devOnly();
  if (blocked) return blocked;
  return Response.json(await fetchAction(api.dev.pushTest, {}));
}
