export type ShelfLifeSource = "fda_chart" | "foodkeeper";
export type TipSource = ShelfLifeSource | "llm";
export type Location = "fridge" | "freezer" | "pantry";

export type ShelfLife = { min: number; max: number; source: ShelfLifeSource; ref: string };
export type SourcedText<S extends TipSource = TipSource> = { text: string; source: S };

export type ReferenceFood = {
  name: string;
  aliases: string[];
  category: string;
  defaultLocation: Location;
  fridgeDays?: ShelfLife;
  freezerDays?: ShelfLife;
  pantryDays?: ShelfLife;
  storageTip?: SourcedText;
  freshnessHint?: SourcedText<"foodkeeper" | "llm">;
  defaultWeightGrams?: number;
};

const RANK: Record<TipSource, number> = { llm: 0, foodkeeper: 1, fda_chart: 2 };
const RANGE_KEYS = ["fridgeDays", "freezerDays", "pantryDays"] as const;

// The FDA chart outranks FoodKeeper, which outranks model-written text; ties go to the newer value.
function better<T extends { source: TipSource }>(current?: T, next?: T): T | undefined {
  if (!next) return current;
  if (!current) return next;
  return RANK[next.source] >= RANK[current.source] ? next : current;
}

function rowRank(food: ReferenceFood): number {
  return Math.max(-1, ...RANGE_KEYS.map((k) => (food[k] ? RANK[food[k].source] : -1)));
}

export function mergeReferenceFood(existing: ReferenceFood | null, incoming: ReferenceFood): ReferenceFood {
  if (!existing) return { ...incoming, aliases: uniqueAliases(incoming.name, incoming.aliases) };
  const base = rowRank(incoming) >= rowRank(existing) ? incoming : existing;
  const merged: ReferenceFood = {
    name: existing.name,
    aliases: uniqueAliases(existing.name, [...existing.aliases, ...incoming.aliases]),
    category: base.category,
    defaultLocation: base.defaultLocation,
  };
  for (const key of RANGE_KEYS) {
    const value = better(existing[key], incoming[key]);
    if (value) merged[key] = value;
  }
  const tip = better(existing.storageTip, incoming.storageTip);
  if (tip) merged.storageTip = tip;
  const hint = better(existing.freshnessHint, incoming.freshnessHint);
  if (hint) merged.freshnessHint = hint;
  const weight = base.defaultWeightGrams ?? existing.defaultWeightGrams ?? incoming.defaultWeightGrams;
  if (weight !== undefined) merged.defaultWeightGrams = weight;
  return merged;
}

function uniqueAliases(name: string, aliases: string[]): string[] {
  return [...new Set(aliases.map((a) => a.toLowerCase().trim()))].filter((a) => a && a !== name);
}
