"use client";

import { useState } from "react";
import type { ItemView } from "@/convex/items";
import { splitFoodName } from "@/lib/foodName";
import { daysLeftLabel, numberWord } from "@/lib/freshness";
import { FoodArt } from "@/app/_components/ui/FoodArt";
import { Leekly } from "@/app/_components/ui/Leekly";

// Matches the row's fade below; the fridge page's undo toast takes over once it is gone.
const FADE_MS = 250;

function UseSoonList({
  items,
  now,
  onUse,
}: {
  items: ItemView[];
  now: number;
  onUse: (item: ItemView) => void;
}) {
  const [leaving, setLeaving] = useState<string[]>([]);

  // Fades and collapses the row, then saves; undo lives in the fridge page's toast.
  const use = (item: ItemView, row: HTMLElement | null) => {
    if (leaving.includes(item._id)) return;
    setLeaving((current) => [...current, item._id]);
    if (row && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      row.style.height = `${row.offsetHeight}px`;
      row.getBoundingClientRect();
      row.style.height = "0px";
      row.style.opacity = "0";
    }
    window.setTimeout(() => {
      if (row) {
        row.style.height = "";
        row.style.opacity = "";
      }
      // Cleared with the save, so an undo brings the item back unchecked.
      setLeaving((current) => current.filter((id) => id !== item._id));
      onUse(item);
    }, FADE_MS);
  };

  return (
    <div className="daily-list suggestions-list" aria-label="Use soon list">
      {items.map((item, index) => {
        const isChecked = leaving.includes(item._id);
        const label = daysLeftLabel(item.expiresAt, now);
        const note = label === "today" ? "goes off today" : `good for ${label}`;
        return (
          <label className={`daily-task ${isChecked ? "is-checked" : ""}`} key={item._id}>
            <input type="checkbox" checked={isChecked} onChange={(event) => use(item, event.currentTarget.closest("label"))} />
            <span className="check-hit" aria-hidden="true">
              <span className="large-check">{isChecked ? "✓" : ""}</span>
            </span>
            <span className="task-number">0{index + 1}</span>
            <FoodArt name={item.name} className="task-icon" />
            <span className="task-copy">
              <strong>use up {splitFoodName(item.name).base}</strong>
              <small>{note}</small>
            </span>
          </label>
        );
      })}
    </div>
  );
}

// Sits under the fridge list; the items come from the same live query, so a used item leaves both.
export function UseSoonSection({
  items,
  now,
  onUse,
}: {
  items: ItemView[];
  now: number;
  onUse: (item: ItemView) => void;
}) {
  const today = new Date(now).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toLowerCase();
  return (
    <section className="fridge-suggestions" aria-labelledby="use-soon-heading">
      <div className="suggestions-intro">
        <div>
          <p className="eyebrow">{today}</p>
          <h2 id="use-soon-heading">use soon.</h2>
          <p className="hero-subtitle">
            {items.length === 0
              ? "nothing urgent today."
              : `${numberWord(items.length)} small ${items.length === 1 ? "thing" : "things"} to save today.`}
          </p>
        </div>
        <Leekly pose="fridge" className="suggestions-mascot" />
      </div>
      {items.length > 0 ? (
        <UseSoonList items={items} now={now} onUse={onUse} />
      ) : (
        <div className="suggestions-empty">
          <Leekly className="suggestions-empty-leek" />
          <p>nothing to save today.</p>
        </div>
      )}
    </section>
  );
}
