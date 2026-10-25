"use client";

import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
import { FoodArt } from "@/app/_components/ui/FoodArt";
import { splitFoodName } from "@/lib/foodName";

export type CatalogFood = FunctionReturnType<typeof api.foods.catalog>[number];

const MAX_SUGGESTIONS = 8;

// Name or alias contains the query; names that start with it come first.
export function suggestionsFor(catalog: readonly CatalogFood[], query: string): CatalogFood[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches = catalog.filter((f) => f.name.includes(q) || f.aliases.some((a) => a.includes(q)));
  const prefix = matches.filter((f) => f.name.startsWith(q));
  return [...prefix, ...matches.filter((f) => !f.name.startsWith(q))].slice(0, MAX_SUGGESTIONS);
}

// Shared by manual entry and the grocery list; the input owns the keyboard, this list owns pointer picks.
export function FoodSuggestions({ id, foods, active, className, iconClassName, onPick }: {
  id: string;
  foods: readonly CatalogFood[];
  active: number;
  className: string;
  iconClassName?: string;
  onPick: (food: CatalogFood) => void;
}) {
  return (
    <div className={className} id={id} role="listbox">
      {foods.map((food, i) => {
        const { base, detail } = splitFoodName(food.name);
        return (
          <button
            type="button"
            role="option"
            id={`${id}-${i}`}
            aria-selected={i === active}
            className={i === active ? "is-active" : ""}
            key={food.name}
            aria-label={food.name}
            title={food.name}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => onPick(food)}
          >
            <FoodArt name={food.name} className={iconClassName} />
            <span className="food-suggestion-name">
              <span className="food-suggestion-base">{base}</span>
              {detail && <span className="food-suggestion-detail">{detail}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
