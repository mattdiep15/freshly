"use client";

import { useState } from "react";
import type { RankedRecipe, Recipe } from "@/lib/recipes";
import { siteName } from "@/lib/recipeWeb";
import { CookingTakeover, phaseDrawing } from "@/app/_components/CookingTakeover";
import { GroceryButton, type Shopping } from "@/app/_components/RecipeGrocery";
import { FoodArt } from "@/app/_components/ui/FoodArt";
import { RecipeDrawing } from "@/app/_components/ui/RecipeDrawing";
import { FixedTag } from "@/app/_components/ui/StatusTag";

function UsedIngredients({ recipe }: { recipe: Recipe }) {
  return recipe.ingredients.slice(0, 2).map((ingredient) => (
    <span className="recipe-used-ingredient" key={ingredient}>
      <FoodArt name={ingredient} className="recipe-used-icon" />
      {ingredient}
    </span>
  ));
}

function RecipeRow({ ranked, expanded, shopping, onToggle, onCook }: {
  ranked: RankedRecipe<unknown>;
  expanded: boolean;
  shopping: Shopping;
  onToggle: () => void;
  onCook: () => void;
}) {
  const { recipe, uses } = ranked;
  const [showIngredients, setShowIngredients] = useState(false);
  const expiringTag = `uses ${uses.length} expiring`;
  const missing = recipe.ingredients.filter((ingredient) => !shopping.inFridge(ingredient));
  const notListed = missing.filter((ingredient) => !shopping.onList(ingredient));

  return (
    <article className={`recipe-row ${expanded ? "is-expanded" : ""}`}>
      <button type="button" className="recipe-summary" aria-expanded={expanded} onClick={onToggle}>
        <span className="recipe-thumbnail-slot">
          <RecipeDrawing name={recipe.dish} className="recipe-thumbnail" />
        </span>
        <span className="recipe-copy">
          <strong>{recipe.name}</strong>
          <small className="desktop-recipe-ingredients">
            <span>uses</span>
            <UsedIngredients recipe={recipe} />
          </small>
          <span className="mobile-recipe-line">
            <RecipeDrawing name="timer" />
            <b>{recipe.minutes} min</b>
            <span className="mobile-used-ingredients">
              · uses
              <UsedIngredients recipe={recipe} />
            </span>
          </span>
        </span>
        <span className="recipe-row-meta">
          <span className="recipe-time">
            <RecipeDrawing name="timer" />
            {recipe.minutes} min
          </span>
          <FixedTag className="recipe-expiring-tag">{expiringTag}</FixedTag>
        </span>
        <span className="recipe-expand-mark" aria-hidden="true">
          {expanded ? "−" : "+"}
        </span>
      </button>
      <div className="recipe-details">
        <div className="recipe-meta-row">
          <span>
            <RecipeDrawing name="timer" />
            {recipe.minutes} min
          </span>
          <span>
            <RecipeDrawing name="flame" />
            {recipe.heat}
          </span>
          <span>
            <RecipeDrawing name="plate" />
            <span className="desktop-servings">{recipe.servings} servings</span>
            <span className="mobile-servings">{recipe.servings}</span>
          </span>
          {recipe.sourceUrl && (
            <span>
              <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">
                from {siteName(recipe.sourceUrl)}
              </a>
            </span>
          )}
        </div>
        <FixedTag className="recipe-mobile-expiring-tag">{expiringTag}</FixedTag>
        <div className="recipe-ingredients">
          <h2 className="desktop-ingredients-title">ingredients</h2>
          <button
            type="button"
            className="mobile-ingredients-toggle"
            aria-expanded={showIngredients}
            onClick={() => setShowIngredients((open) => !open)}
          >
            <span>ingredients {recipe.ingredients.length}</span>
            <span>{showIngredients ? "−" : "+"}</span>
          </button>
          {missing.length === 0 && (
            <p className="ingredients-complete">
              <span>✓</span> you have everything.
            </p>
          )}
          <ul className={showIngredients ? "is-expanded" : ""}>
            {recipe.ingredients.map((ingredient) => (
              <li key={ingredient}>
                <span className="recipe-ingredient-art">
                  <FoodArt name={ingredient} />
                </span>
                <span>{ingredient}</span>
                {shopping.inFridge(ingredient) ? (
                  <span className="ingredient-check" aria-label="In your fridge">
                    ✓
                  </span>
                ) : (
                  <GroceryButton
                    className="ingredient-grocery-button"
                    listed={shopping.onList(ingredient)}
                    onAdd={() => shopping.onAdd(recipe, [ingredient])}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="recipe-steps">
          <h2>steps</h2>
          <ol>
            {recipe.steps.map((step, index) => (
              <li key={index}>
                <span className="phase-icon">
                  <RecipeDrawing name={phaseDrawing(recipe, step.phase)} />
                </span>
                <span className="phase-copy">
                  <strong>{step.phase}</strong>
                  <span>
                    <b>{String(index + 1).padStart(2, "0")}</b>
                    {step.text}
                  </span>
                </span>
                {step.whisk && <RecipeDrawing name="whisk" className="step-whisk" />}
              </li>
            ))}
          </ol>
        </div>
        <div className="recipe-primary-actions">
          {missing.length >= 2 && (
            <button
              type="button"
              className={`add-missing-groceries ${notListed.length === 0 ? "is-complete" : ""}`}
              disabled={notListed.length === 0}
              onClick={() => shopping.onAdd(recipe, notListed)}
            >
              {notListed.length === 0 ? "all on your list ✓" : `add ${notListed.length} missing to grocery list`}
            </button>
          )}
          <button type="button" className="start-cooking" onClick={onCook}>
            start cooking
          </button>
        </div>
      </div>
    </article>
  );
}

// One recipe open at a time; opening another closes the last.
export function RecipeList({ recipes, shopping }: { recipes: RankedRecipe<unknown>[]; shopping: Shopping }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cooking, setCooking] = useState<Recipe | null>(null);

  return (
    <section className="recipe-list" aria-label="Recipes">
      {recipes.map((ranked) => (
        <RecipeRow
          key={ranked.recipe.id}
          ranked={ranked}
          expanded={expandedId === ranked.recipe.id}
          shopping={shopping}
          onToggle={() => setExpandedId(expandedId === ranked.recipe.id ? null : ranked.recipe.id)}
          onCook={() => setCooking(ranked.recipe)}
        />
      ))}
      {recipes.length === 0 && (
        <div className="recipes-empty">
          <RecipeDrawing name="chef-leek" className="recipes-empty-chef" />
          <strong>nothing to match yet.</strong>
          <p>try fewer ingredients.</p>
        </div>
      )}
      {cooking && <CookingTakeover recipe={cooking} shopping={shopping} onClose={() => setCooking(null)} />}
    </section>
  );
}
