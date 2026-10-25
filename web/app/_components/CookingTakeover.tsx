"use client";

import { useEffect, useState } from "react";
import type { Recipe, RecipeStep } from "@/lib/recipes";
import { CookingMissing, type Shopping } from "@/app/_components/RecipeGrocery";
import { RecipeDrawing, type RecipeDrawingName } from "@/app/_components/ui/RecipeDrawing";

export function phaseDrawing(recipe: Recipe, phase: RecipeStep["phase"]): RecipeDrawingName {
  if (phase === "prep") return "cutting-board";
  return phase === "cook" ? recipe.cookTool : "plate";
}

function countdown(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

// One step per screen; a timed step counts down from its minutes when it opens.
export function CookingTakeover({ recipe, shopping, onClose }: { recipe: Recipe; shopping: Shopping; onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step: RecipeStep | undefined = recipe.steps[stepIndex];
  const [secondsLeft, setSecondsLeft] = useState((step?.timedMinutes ?? 0) * 60);
  const running = secondsLeft > 0;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const goTo = (index: number) => {
    setStepIndex(index);
    setSecondsLeft((recipe.steps[index]?.timedMinutes ?? 0) * 60);
  };

  return (
    <section className="cooking-takeover" role="dialog" aria-modal="true" aria-label={`Cooking ${recipe.name}`}>
      <div className="cooking-card">
        <div className="cooking-top-row">
          <button type="button" className="cooking-close" onClick={onClose}>
            ← back
          </button>
          <span className="cooking-progress">
            {step ? `step ${stepIndex + 1} of ${recipe.steps.length}` : "complete"}
          </span>
          <span className="cooking-top-phase-icon">
            <RecipeDrawing name={step ? phaseDrawing(recipe, step.phase) : "plate"} />
          </span>
        </div>
        <span className="cooking-phase">{step?.phase ?? "serve"}</span>
        <RecipeDrawing
          name={!step ? "plate" : step.timedMinutes ? "timer" : phaseDrawing(recipe, step.phase)}
          className="cooking-step-art"
        />
        {step?.timedMinutes && <strong className="cooking-countdown">{countdown(secondsLeft)}</strong>}
        <h2>{step ? step.text : "enjoy!"}</h2>
        {/* The first step is the last chance to fetch what the recipe still needs. */}
        {step && stepIndex === 0 && <CookingMissing recipe={recipe} shopping={shopping} />}
        <div className="cooking-actions">
          {step ? (
            <>
              <button type="button" disabled={stepIndex === 0} onClick={() => goTo(stepIndex - 1)}>
                ← previous
              </button>
              <button type="button" className="cooking-next" onClick={() => goTo(stepIndex + 1)}>
                next →
              </button>
            </>
          ) : (
            <button type="button" className="cooking-next cooking-done" onClick={onClose}>
              done
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
