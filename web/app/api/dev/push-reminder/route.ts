import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { REMINDER_DAYS } from "@/lib/digest";
import { devOnly } from "../../_lib/dev-only";

// ?days=1, 3 (default), or 7 matches the seeded chicken breast, mushrooms, and eggs.
export async function GET(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const requested = Number(new URL(req.url).searchParams.get("days") ?? 3);
  const days = REMINDER_DAYS.find((d) => d === requested);
  if (days === undefined) return Response.json({ error: `days must be one of ${REMINDER_DAYS.join(", ")}` }, { status: 400 });
  return Response.json(await fetchMutation(api.dev.pushReminder, { days }));
}
