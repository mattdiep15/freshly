"use client";

import { useEffect, useRef, useState } from "react";
import type { ItemView } from "@/convex/items";
import { daysLeftLabel, numberWord } from "@/lib/freshness";
import { FoodArt } from "@/app/_components/ui/FoodArt";
import { Leekly } from "@/app/_components/ui/Leekly";

// Long enough to see the check, and to uncheck a misclick before it is saved; P1 has no undo.
const SAVE_DELAY_MS = 900;

function UseSoonList({
  items,
  now,
  onUse,
}: {
  items: ItemView[];
  now: number;
  onUse: (item: ItemView) => void;
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const pending = useRef(new Map<string, { timer: number; save: () => void }>());

  // Leaving the page saves pending checks instead of dropping them.
  useEffect(() => {
    const saves = pending.current;
    return () =>
      saves.forEach(({ timer, save }) => {
        window.clearTimeout(timer);
        save();
      });
  }, []);

  const toggle = (item: ItemView) => {
    const entry = pending.current.get(item._id);
    if (entry) {
      window.clearTimeout(entry.timer);
      pending.current.delete(item._id);
      setChecked((current) => current.filter((id) => id !== item._id));
      return;
    }
    setChecked((current) => [...current, item._id]);
    const save = () => {
      pending.current.delete(item._id);
      onUse(item);
    };
    pending.current.set(item._id, { timer: window.setTimeout(save, SAVE_DELAY_MS), save });
  };

  return (
    <div className="daily-list suggestions-list" aria-label="Use soon list">
      {items.map((item, index) => {
        const isChecked = checked.includes(item._id);
        const label = daysLeftLabel(item.expiresAt, now);
        const note = label === "today" ? "goes off today" : `good for ${label}`;
        return (
          <label className={`daily-task ${isChecked ? "is-checked" : ""}`} key={item._id}>
            <input type="checkbox" checked={isChecked} onChange={() => toggle(item)} />
            <span className="check-hit" aria-hidden="true">
              <span className="large-check">{isChecked ? "✓" : ""}</span>
            </span>
            <span className="task-number">0{index + 1}</span>
            <FoodArt name={item.name} packaged={item.packaged} className="task-icon" />
            <span className="task-copy">
              <strong>use up {item.name}</strong>
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
