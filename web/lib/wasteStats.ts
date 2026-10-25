const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const GRAMS_PER_LB = 453.6;

export type WasteRange = "week" | "month" | "all";
// TODO(release): hardcoded guess; a binary "wasted" swipe does not say how much was thrown out
export const DEFAULT_WASTED_FRACTION = 0.5;

export type ResolvedItem = {
  status: "used" | "wasted";
  resolvedAt: number;
  fractionWasted?: number;
  priceCents?: number;
  weightGrams?: number;
};

export type WasteSummary = {
  range: WasteRange;
  itemsUsed: number;
  itemsWasted: number;
  usedRate: number | null; // null when nothing was resolved in range
  wastedCents: number;
  wastedGrams: number;
  wastedLbs: number;
  itemsMissingPrice: number; // wasted-in-part items left out of wastedCents
  itemsMissingWeight: number;
};

// Calendar periods in the user's time zone, weeks starting Monday, so totals and rankings only move when someone resolves an item.
export function periodStart(range: WasteRange, now: number, utcOffsetMinutes: number): number {
  if (range === "all") return -Infinity;
  const local = new Date(now + utcOffsetMinutes * MINUTE);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const localStart =
    range === "month"
      ? Date.UTC(year, month, 1)
      : Date.UTC(year, month, local.getUTCDate()) - ((local.getUTCDay() + 6) % 7) * DAY;
  return localStart - utcOffsetMinutes * MINUTE;
}

export function summarizeWaste(items: ResolvedItem[], range: WasteRange, now: number, utcOffsetMinutes: number): WasteSummary {
  const since = periodStart(range, now, utcOffsetMinutes);
  const inRange = items.filter((i) => i.resolvedAt >= since && i.resolvedAt <= now);

  let wastedCents = 0;
  let wastedGrams = 0;
  let itemsMissingPrice = 0;
  let itemsMissingWeight = 0;
  for (const i of inRange) {
    const fraction = i.fractionWasted ?? (i.status === "wasted" ? DEFAULT_WASTED_FRACTION : 0);
    if (fraction === 0) continue;
    if (i.priceCents === undefined) itemsMissingPrice++;
    else wastedCents += i.priceCents * fraction;
    if (i.weightGrams === undefined) itemsMissingWeight++;
    else wastedGrams += i.weightGrams * fraction;
  }

  const itemsUsed = inRange.filter((i) => i.status === "used").length;
  const itemsWasted = inRange.length - itemsUsed;
  return {
    range,
    itemsUsed,
    itemsWasted,
    usedRate: inRange.length === 0 ? null : itemsUsed / inRange.length,
    wastedCents: Math.round(wastedCents),
    wastedGrams: Math.round(wastedGrams),
    wastedLbs: Math.round((wastedGrams / GRAMS_PER_LB) * 100) / 100,
    itemsMissingPrice,
    itemsMissingWeight,
  };
}
