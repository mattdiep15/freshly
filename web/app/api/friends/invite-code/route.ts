import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { devOnly } from "../../_lib/dev-only";

export async function GET() {
  const blocked = devOnly();
  if (blocked) return blocked;
  return Response.json({ code: await fetchMutation(api.friends.inviteCode, {}) });
}
