"use client";

import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { daysUntil, freshness, sortByUrgency } from "@/lib/freshness";
import { groceryKey } from "@/lib/grocery";
import { rankRecipes, RECIPES, usesItem, type Recipe } from "@/lib/recipes";
import type { Shopping } from "@/app/_components/RecipeGrocery";
import { RecipeList } from "@/app/_components/RecipeList";
import { addNewGroceries, removeNewGroceries } from "@/app/_components/useNewGroceryCount";
import { FoodArt } from "@/app/_components/ui/FoodArt";
import { RecipeDrawing } from "@/app/_components/ui/RecipeDrawing";
import { useNow } from "@/app/_components/useNow";

const TOAST_MS = 3000;

// A failed add leaves the button as it was, so the user can tap it again.
const ignoreFailure = () => {};

type Added = { entryId: Id<"groceryItems">; name: string }[];

function GroceryToast({ added, onUndo, onDone }: { added: Added; onUndo: () => void; onDone: () => void }) {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setTimeout(onDone, TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [added, onDone]);
  return (
    <div className="recipe-grocery-toast" role="status">
      <span>{added.length === 1 ? `added ${added[0].name} to grocery list` : `added ${added.length} items to grocery list`}</span>
      <button type="button" onClick={onUndo}>
        undo
      </button>
      <button type="button" onClick={() => router.push("/grocery")}>
        view list
      </button>
    </div>
  );
}

export default function RecipesPage() {
  const now = useNow();
  const active = useQuery(api.items.list, { status: "active" });
  const groceryRows = useQuery(api.grocery.list);
  const addFromRecipe = useMutation(api.grocery.addFromRecipe);
  const removeEntry = useMutation(api.grocery.remove);
  const [added, setAdded] = useState<Added | null>(null);
  // Stable, so live-query renders do not restart the toast timer.
  const dismissToast = useCallback(() => setAdded(null), []);
  const suggestion = useQuery(api.recipes.today);
  const request = useMutation(api.recipes.request);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Starts today's web search when the use-soon items changed; the fixed list shows until it is ready.
  useEffect(() => {
    request().catch((e) => console.warn("recipes.request failed", e));
  }, [request]);
  if (now === null || active === undefined || groceryRows === undefined) {
    return <main className="recipes-page" aria-busy="true" />;
  }

  // Chips come from use-soon items only; expired ones belong to the swipe check-in.
  const soonItems = sortByUrgency(active, now)
    .filter((item) => freshness(item.expiresAt, now) === "soon")
    .map((item) => ({ ...item, daysLeft: item.expiresAt === undefined ? Infinity : daysUntil(item.expiresAt, now) }));
  // A selected item that left use-soon drops out of the filter on its own.
  const selected = soonItems.filter((item) => selectedIds.includes(item._id));
  // Web recipes go first so they win ties in the stable sort.
  const recipes = [...(suggestion?.status === "ready" ? suggestion.recipes : []), ...RECIPES];
  const listed = new Set(groceryRows.filter((row) => row.checkedAt === undefined).map((row) => groceryKey(row.name)));
  const shopping: Shopping = {
    inFridge: (ingredient) => active.some((item) => usesItem(ingredient, item.name)),
    onList: (ingredient) => listed.has(groceryKey(ingredient)),
    onAdd: (recipe: Recipe, names: string[]) => {
      addFromRecipe({ recipeName: recipe.name, names })
        .then((entries) => {
          if (entries.length === 0) return;
          addNewGroceries(entries.length);
          setAdded(entries);
        })
        .catch(ignoreFailure);
    },
  };
  const undo = () => {
    if (!added) return;
    setAdded(null);
    removeNewGroceries(added.length);
    for (const { entryId } of added) removeEntry({ entryId }).catch(ignoreFailure);
  };
  const toggle = (id: string) =>
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id]));

  return (
    <main className="recipes-page">
      <section className="recipes-heading">
        <div>
          <p className="eyebrow">based on your fridge</p>
          <h1>what to cook.</h1>
        </div>
        <RecipeDrawing name="chef-leek" className="recipes-chef" />
      </section>
      {soonItems.length > 0 && (
        <div className="ingredient-chips" aria-label="Filter recipes by ingredients">
          {soonItems.map((item) => {
            const isSelected = selectedIds.includes(item._id);
            return (
              <button
                type="button"
                key={item._id}
                className={isSelected ? "is-selected" : ""}
                aria-pressed={isSelected}
                onClick={() => toggle(item._id)}
              >
                <FoodArt name={item.name} className="ingredient-chip-art" />
                <span>{item.name.toLowerCase()}</span>
              </button>
            );
          })}
        </div>
      )}
      <RecipeList recipes={rankRecipes(recipes, soonItems, selected)} shopping={shopping} />
      {added && <GroceryToast added={added} onUndo={undo} onDone={dismissToast} />}
    </main>
  );
}
