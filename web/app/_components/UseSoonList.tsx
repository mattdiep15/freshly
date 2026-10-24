"use client";

import { useEffect, useRef, useState } from "react";
import type { ItemView } from "@/convex/items";
import { daysLeftLabel } from "@/lib/freshness";
import { FoodArt } from "@/app/_components/ui/FoodArt";

// Long enough to see the check, and to uncheck a misclick before it is saved; P1 has no undo.
const SAVE_DELAY_MS = 900;

export function UseSoonList({
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
    <section className="daily-list" aria-label="Use soon list">
      {items.map((item, index) => {
        const isChecked = checked.includes(item._id);
        const label = daysLeftLabel(item.expiresAt, now);
        return (
          <label className={`daily-task ${isChecked ? "is-checked" : ""}`} key={item._id}>
            <input type="checkbox" checked={isChecked} onChange={() => toggle(item)} />
            <span className="large-check" aria-hidden="true">
              {isChecked ? "✓" : ""}
            </span>
            <span className="task-number">0{index + 1}</span>
            <FoodArt name={item.name} packaged={item.packaged} className="task-icon" />
            <span className="task-copy">
              <strong>use up {item.name}</strong>
              <small>{label === "today" ? "goes off today" : `good for ${label}`}</small>
            </span>
          </label>
        );
      })}
    </section>
  );
}
