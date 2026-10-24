export type RecipeStep = {
  phase: "prep" | "cook" | "serve";
  text: string;
  timedMinutes?: number;
  whisk?: boolean;
};

export type Recipe = {
  id: string;
  name: string;
  // Generic words, so "chicken" matches a fridge item named "Chicken breast".
  ingredients: string[];
  minutes: number;
  dish: "pot" | "pan" | "bowl";
  cookTool: "pot" | "pan";
  heat: string;
  servings: number;
  steps: RecipeStep[];
  sourceUrl?: string; // set on recipes read from a web page
};

// TODO(release): replace the static fallback with a larger catalog; web recipes from recipes.today rank first.
export const RECIPES: Recipe[] = [
  {
    id: "chicken-spinach-pasta",
    name: "chicken and spinach pasta",
    ingredients: ["chicken", "spinach", "pasta", "garlic", "olive oil"],
    minutes: 25,
    dish: "pot",
    cookTool: "pot",
    heat: "medium",
    servings: 2,
    steps: [
      { phase: "prep", text: "Slice the chicken and chop the garlic." },
      { phase: "cook", text: "Cook chicken, garlic, and spinach, then fold in the pasta.", timedMinutes: 15 },
      { phase: "serve", text: "Divide between plates and finish with olive oil." },
    ],
  },
  {
    id: "strawberry-yogurt-bowl",
    name: "strawberry yogurt bowl",
    ingredients: ["strawberries", "greek yogurt", "oats", "honey"],
    minutes: 5,
    dish: "bowl",
    cookTool: "pot",
    heat: "none",
    servings: 2,
    steps: [
      { phase: "prep", text: "Slice the strawberries." },
      { phase: "cook", text: "Whisk the yogurt and honey until smooth.", whisk: true },
      { phase: "serve", text: "Spoon into bowls and top with strawberries and oats." },
    ],
  },
  {
    id: "garlic-spinach-omelette",
    name: "garlic spinach omelette",
    ingredients: ["spinach", "eggs", "garlic", "butter"],
    minutes: 10,
    dish: "pan",
    cookTool: "pan",
    heat: "medium",
    servings: 2,
    steps: [
      { phase: "prep", text: "Whisk the eggs and chop the garlic.", whisk: true },
      { phase: "cook", text: "Wilt spinach and garlic, add eggs, and cook until set.", timedMinutes: 6 },
      { phase: "serve", text: "Fold the omelette and slide onto plates." },
    ],
  },
  {
    id: "salmon-rice-bowl",
    name: "salmon rice bowl",
    ingredients: ["salmon", "rice", "spinach", "soy sauce"],
    minutes: 20,
    dish: "bowl",
    cookTool: "pan",
    heat: "medium",
    servings: 2,
    steps: [
      { phase: "prep", text: "Pat the salmon dry and portion the spinach." },
      { phase: "cook", text: "Cook the salmon and wilt the spinach while the rice warms.", timedMinutes: 12 },
      { phase: "serve", text: "Build the bowls and finish with soy sauce." },
    ],
  },
  {
    id: "banana-oat-pancakes",
    name: "banana oat pancakes",
    ingredients: ["bananas", "oats", "eggs", "butter"],
    minutes: 20,
    dish: "pan",
    cookTool: "pan",
    heat: "medium",
    servings: 2,
    steps: [
      { phase: "prep", text: "Mash the bananas, then whisk with eggs and oats.", whisk: true },
      { phase: "cook", text: "Cook small pancakes in a buttered pan.", timedMinutes: 12 },
      { phase: "serve", text: "Stack the pancakes and serve warm." },
    ],
  },
];

// Drops a plural ending so "strawberry" and "strawberries" compare equal.
function stem(word: string): string {
  return word.replace(/ies$/, "y").replace(/([^s])s$/, "$1");
}

function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z]+/).filter(Boolean).map(stem);
}

// True when every word of the ingredient appears in the item's name.
export function usesItem(ingredient: string, itemName: string): boolean {
  const name = new Set(words(itemName));
  return words(ingredient).every((w) => name.has(w));
}

export type RankedRecipe<T> = { recipe: Recipe; uses: T[] };

// Keeps recipes that use every selected item, then ranks by how many use-soon items they use and how soon those expire.
export function rankRecipes<T extends { name: string; daysLeft: number }>(
  recipes: Recipe[],
  soonItems: T[],
  selected: T[],
): RankedRecipe<T>[] {
  const usedBy = (recipe: Recipe, item: T) => recipe.ingredients.some((ingredient) => usesItem(ingredient, item.name));
  const nearest = (items: T[]) => Math.min(Infinity, ...items.map((i) => i.daysLeft));
  return recipes
    .filter((recipe) => selected.every((item) => usedBy(recipe, item)))
    .map((recipe) => ({ recipe, uses: soonItems.filter((item) => usedBy(recipe, item)) }))
    .sort((a, b) => b.uses.length - a.uses.length || nearest(a.uses) - nearest(b.uses));
}
