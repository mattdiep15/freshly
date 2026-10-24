export type FullnessStage = 10 | 40 | 70 | 100;

// Item count stands in for fullness until items record a size.
export function fullnessStage(itemCount: number): FullnessStage {
  if (itemCount <= 3) return 10;
  if (itemCount <= 6) return 40;
  if (itemCount <= 10) return 70;
  return 100;
}

export type FoodGroup = "vegetables" | "fruit" | "protein" | "dairy-eggs" | "grains" | "other";

const GROUP_BY_CATEGORY: Record<string, FoodGroup> = {
  meat: "protein",
  poultry: "protein",
  seafood: "protein",
  deli: "protein",
  "vegetarian proteins": "protein",
  dairy: "dairy-eggs",
  eggs: "dairy-eggs",
  bakery: "grains",
  grains: "grains",
  "refrigerated dough": "grains",
};

// Maps a foods.category to a manual-entry group; produce is null because it could be fruit or vegetables.
export function groupForCategory(category: string): FoodGroup | null {
  if (category === "produce") return null;
  return GROUP_BY_CATEGORY[category] ?? "other";
}
