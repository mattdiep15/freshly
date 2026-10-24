// TODO(release): delete this file once pages read from Convex (p1-01 seed, p1-02 receipts, p1-03 stats).
import type { FridgeItem, SourcedText } from "@/lib/types";

const FDA_PACKAGE_TIP: SourcedText = {
  text: "keep meat and poultry in its package until just before using.",
  source: "fda_chart",
};

function endOfDay(now: number, daysFromToday: number): number {
  const d = new Date(now);
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(23, 59, 0, 0);
  return d.getTime();
}

// FDA rows: poultry parts 1-2 days, eggs in shell 3-5 weeks, cooked poultry dishes 3-4 days.
// Produce and dairy have no sourced value until FoodKeeper lands, so their dates are user-set.
export function demoFridge(now: number): FridgeItem[] {
  return [
    { id: "chicken", name: "chicken thighs", expiresAt: endOfDay(now, 0), expirySource: "fda_chart", storageTip: FDA_PACKAGE_TIP },
    { id: "berries", name: "strawberries", expiresAt: endOfDay(now, 1), expirySource: "user" },
    { id: "spinach", name: "spinach", expiresAt: endOfDay(now, 2), expirySource: "user" },
    { id: "oatmilk", name: "oat milk", expiresAt: endOfDay(now, 6), expirySource: "user" },
    { id: "yogurt", name: "greek yogurt", expiresAt: endOfDay(now, 8), expirySource: "user" },
    { id: "eggs", name: "eggs", expiresAt: endOfDay(now, 25), expirySource: "fda_chart" },
    { id: "bananas", name: "bananas" },
    { id: "curry", name: "leftover chicken curry", expiresAt: endOfDay(now, -1), expirySource: "fda_chart" },
  ];
}

// TODO(release): no backend tracks fridge fullness or food groups yet; derive both from items.
export const demoFullness = {
  stage: 70,
  stocked: ["vegetables", "fruit", "protein", "dairy", "grains"],
  empty: ["frozen foods"],
} as const;

export type ParsedReceiptLine = {
  name: string;
  shelfLifeDays?: number;
  storageTip?: SourcedText;
};

// Shelf life uses the low end of the FDA range; lines without a sourced value stay blank.
export const demoParsedReceipt: ParsedReceiptLine[] = [
  { name: "eggs", shelfLifeDays: 21 },
  { name: "chicken thighs", shelfLifeDays: 1, storageTip: FDA_PACKAGE_TIP },
  { name: "bananas" },
  { name: "cilantro" },
];

export const demoStats = {
  totals: { rescued: 38, lbsWasted: 4.2, streakDays: 12 },
  weeks: [
    { label: "this week", rescued: 9, lbsWasted: 0.4 },
    { label: "last week", rescued: 11, lbsWasted: 0.8 },
    { label: "oct 5–11", rescued: 8, lbsWasted: 1.2 },
    { label: "sep 28–oct 4", rescued: 10, lbsWasted: 1.8 },
  ],
};

export const demoLeaderboard = [
  { name: "maya", lbsWasted: 0.2, streakDays: 18, isYou: false },
  { name: "you", lbsWasted: 0.4, streakDays: 12, isYou: true },
  { name: "theo", lbsWasted: 0.7, streakDays: 9, isYou: false },
  { name: "dev", lbsWasted: 1.1, streakDays: 6, isYou: false },
  { name: "nina", lbsWasted: 1.4, streakDays: 4, isYou: false },
];
