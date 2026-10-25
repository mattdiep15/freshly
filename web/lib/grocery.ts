import { usesItem } from "./recipes";

// "  Oat   Milk " and "oat milk" are the same list row.
export function groceryKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

type Entry<Id> = { _id: Id; name: string; foodId?: string; checkedAt?: number };
type BoughtItem = { name: string; foodId?: string };

// Unchecked entries that a newly bought item covers: same food when both have one, else the same name.
export function entriesToCheckOff<Id>(entries: readonly Entry<Id>[], items: readonly BoughtItem[]): Id[] {
  const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  return entries
    .filter((entry) => entry.checkedAt === undefined)
    .filter((entry) =>
      items.some((item) =>
        entry.foodId && item.foodId ? entry.foodId === item.foodId : sameName(entry.name, item.name),
      ),
    )
    .map((entry) => entry._id);
}

// TODO(release): replace the static pairings with recipe data once recipes come from a real source.
const PAIRINGS: Record<string, string[]> = {
  eggs: ["spinach"],
  garlic: ["spinach"],
  rice: ["salmon"],
  "soy sauce": ["salmon"],
  "oat milk": ["strawberries"],
};

export type GroceryHint =
  | { kind: "recipe"; text: string }
  | { kind: "wasted"; text: string }
  | { kind: "in-fridge"; text: string; count: number }
  | { kind: "pairs"; text: string; with: string };

// One hint per row, in priority order: the recipe it was added for, past waste, what's already in the fridge, then a use-soon pairing.
export function groceryHint(
  name: string,
  { wastedNames, fridge, soonNames }: {
    wastedNames: readonly string[];
    fridge: readonly { name: string; quantity: number }[];
    soonNames: readonly string[];
  },
  recipeName?: string,
): GroceryHint | null {
  if (recipeName) return { kind: "recipe", text: `for ${recipeName.toLowerCase()}.` };
  const key = groceryKey(name);
  if (wastedNames.some((wasted) => usesItem(key, wasted))) {
    return { kind: "wasted", text: "you wasted some last time. buy less." };
  }
  const count = fridge.filter((item) => usesItem(key, item.name)).reduce((sum, item) => sum + item.quantity, 0);
  if (count > 0) return { kind: "in-fridge", text: `you still have ${count} in your fridge.`, count };
  const pair = PAIRINGS[key]?.find((food) => soonNames.some((soon) => usesItem(food, soon)));
  return pair ? { kind: "pairs", text: `goes well with ${pair}.`, with: pair } : null;
}
