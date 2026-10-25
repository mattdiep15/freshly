export type ShelfLifeSource = "fda_chart" | "foodkeeper" | "web";
export type TipSource = "fda_chart" | "foodkeeper" | "web" | "llm";
export type Location = "fridge" | "freezer" | "pantry";

export type ShelfLife = { min: number; max: number; source: ShelfLifeSource; ref: string };
export type SourcedText<S extends TipSource = TipSource> = { text: string; source: S; ref?: string };

export type ReferenceFood = {
  name: string;
  aliases: string[];
  category: string;
  defaultLocation: Location;
  fridgeDays?: ShelfLife;
  freezerDays?: ShelfLife;
  pantryDays?: ShelfLife;
  storageTip?: SourcedText;
  freshnessHint?: SourcedText<"foodkeeper" | "web" | "llm">;
  defaultWeightGrams?: number;
};

const RANK: Record<ShelfLifeSource | TipSource, number> = { llm: 0, web: 1, foodkeeper: 2, fda_chart: 3 };
const RANGE_KEYS = ["fridgeDays", "freezerDays", "pantryDays"] as const;

// The FDA chart outranks FoodKeeper, which outranks web pages and model-written text; ties go to the newer value.
function better<T extends { source: ShelfLifeSource | TipSource }>(current?: T, next?: T): T | undefined {
  if (!next) return current;
  if (!current) return next;
  return RANK[next.source] >= RANK[current.source] ? next : current;
}

function rowRank(food: ReferenceFood): number {
  return Math.max(-1, ...RANGE_KEYS.map((k) => (food[k] ? RANK[food[k].source] : -1)));
}

// dataset names the file incoming comes from, so a range that file no longer lists is dropped on re-import.
export function mergeReferenceFood(
  existing: ReferenceFood | null,
  incoming: ReferenceFood,
  dataset?: ShelfLifeSource,
): ReferenceFood {
  if (!existing) return { ...incoming, aliases: uniqueAliases(incoming.name, incoming.aliases) };
  const base = rowRank(incoming) >= rowRank(existing) ? incoming : existing;
  const merged: ReferenceFood = {
    name: existing.name,
    aliases: uniqueAliases(existing.name, [...existing.aliases, ...incoming.aliases]),
    category: base.category,
    defaultLocation: base.defaultLocation,
  };
  for (const key of RANGE_KEYS) {
    const stale = dataset !== undefined && !incoming[key] && existing[key]?.source === dataset;
    const value = better(stale ? undefined : existing[key], incoming[key]);
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
