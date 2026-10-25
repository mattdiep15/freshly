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

export type StashGroup = "vegetables" | "fruit" | "protein" | "dairy" | "grains" | "frozen foods";

const STASH_GROUPS: StashGroup[] = ["vegetables", "fruit", "protein", "dairy", "grains", "frozen foods"];

// FoodKeeper files fruit and vegetables together under produce; these name the fruit rows.
const FRUIT =
  /apple|apricot|avocado|banana|berr|cherimoya|cherr|citrus|lemon|lime|orange|grapefruit|tangerine|clementine|coconut|\bdates?\b|grape|guava|kiwi|melon|papaya|mango|feijoa|passionfruit|peach|nectarine|plum|pear|sapote|pineapple|plantain|pomegranate|kumquat|star fruit|pitaya|dragon fruit|cantaloupe|honeydew|\bfigs?\b|lychee/;

// The fridge summary group for a matched food; null for groups the summary leaves out, like condiments.
export function stashGroupFor(foodName: string, category: string): StashGroup | null {
  if (category === "frozen") return "frozen foods";
  if (category === "produce") return FRUIT.test(foodName.toLowerCase()) ? "fruit" : "vegetables";
  const group = groupForCategory(category);
  if (group === "dairy-eggs") return "dairy";
  return group === "other" || group === null ? null : group;
}

// Which summary groups the fridge has; anything in the freezer also counts as frozen food.
export function stashGroups(items: readonly { stashGroup: StashGroup | null; location: string }[]): {
  stocked: StashGroup[];
  empty: StashGroup[];
} {
  const have = new Set<StashGroup>();
  for (const item of items) {
    if (item.stashGroup) have.add(item.stashGroup);
    if (item.location === "freezer") have.add("frozen foods");
  }
  return { stocked: STASH_GROUPS.filter((g) => have.has(g)), empty: STASH_GROUPS.filter((g) => !have.has(g)) };
}
