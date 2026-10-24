import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { devOnly } from "../../_lib/dev-only";

export async function GET(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const params = new URL(req.url).searchParams;
  const now = params.get("now");
  return Response.json(
    await fetchMutation(api.dev.runTick, {
      now: now === null ? undefined : Date.parse(now),
      force: params.get("force") === "1" || params.get("force") === "true",
    }),
  );
}
