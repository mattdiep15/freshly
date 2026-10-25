"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { daysUntil, freshness, sortByUrgency } from "@/lib/freshness";
import { rankRecipes, RECIPES } from "@/lib/recipes";
import { RecipeList } from "@/app/_components/RecipeList";
import { FoodArt } from "@/app/_components/ui/FoodArt";
import { RecipeDrawing } from "@/app/_components/ui/RecipeDrawing";
import { useNow } from "@/app/_components/useNow";

export default function RecipesPage() {
  const now = useNow();
  const active = useQuery(api.items.list, { status: "active" });
  const suggestion = useQuery(api.recipes.today);
  const request = useMutation(api.recipes.request);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Starts today's web search when the use-soon items changed; the fixed list shows until it is ready.
  useEffect(() => {
    request().catch((e) => console.warn("recipes.request failed", e));
  }, [request]);
  if (now === null || active === undefined) return <main className="recipes-page" aria-busy="true" />;

  // Chips come from use-soon items only; expired ones belong to the swipe check-in.
  const soonItems = sortByUrgency(active, now)
    .filter((item) => freshness(item.expiresAt, now) === "soon")
    .map((item) => ({ ...item, daysLeft: item.expiresAt === undefined ? Infinity : daysUntil(item.expiresAt, now) }));
  // A selected item that left use-soon drops out of the filter on its own.
  const selected = soonItems.filter((item) => selectedIds.includes(item._id));
  // Web recipes go first so they win ties in the stable sort.
  const recipes = [...(suggestion?.status === "ready" ? suggestion.recipes : []), ...RECIPES];
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
      <RecipeList recipes={rankRecipes(recipes, soonItems, selected)} fridgeNames={active.map((item) => item.name)} />
    </main>
  );
}
