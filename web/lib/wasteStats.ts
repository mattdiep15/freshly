const DAY = 24 * 60 * 60 * 1000;
const GRAMS_PER_LB = 453.6;

export type WasteRange = "week" | "month" | "all";
// TODO(release): hardcoded guess; a binary "wasted" swipe does not say how much was thrown out
export const DEFAULT_WASTED_FRACTION = 0.5;

const RANGE_DAYS: Record<WasteRange, number | null> = { week: 7, month: 30, all: null };

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

export function summarizeWaste(items: ResolvedItem[], range: WasteRange, now: number): WasteSummary {
  const days = RANGE_DAYS[range];
  const since = days === null ? -Infinity : now - days * DAY;
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
