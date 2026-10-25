import type { Recipe } from "@/lib/recipes";

// Ingredients the fridge does not have, and which of those are already unchecked on the grocery list.
export type Shopping = {
  inFridge: (ingredient: string) => boolean;
  onList: (ingredient: string) => boolean;
  onAdd: (recipe: Recipe, ingredients: string[]) => void;
};

export function GroceryButton({ listed, onAdd, className = "" }: { listed: boolean; onAdd: () => void; className?: string }) {
  return (
    <button type="button" className={`${className} ${listed ? "is-added" : ""}`} disabled={listed} onClick={onAdd}>
      {listed ? "on list ✓" : "+ grocery list"}
    </button>
  );
}

export function CookingMissing({ recipe, shopping }: { recipe: Recipe; shopping: Shopping }) {
  const ingredient = recipe.ingredients.find((name) => !shopping.inFridge(name));
  if (!ingredient) return null;
  return (
    <div className="cooking-missing">
      <span>missing: {ingredient}</span>
      <GroceryButton listed={shopping.onList(ingredient)} onAdd={() => shopping.onAdd(recipe, [ingredient])} />
    </div>
  );
}
