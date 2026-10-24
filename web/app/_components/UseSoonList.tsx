"use client";

import { useState } from "react";
import { daysLeftLabel } from "@/lib/freshness";
import type { FridgeItem } from "@/lib/types";
import { FoodArt } from "@/app/_components/ui/FoodArt";

export function UseSoonList({ items, now }: { items: FridgeItem[]; now: number }) {
  // TODO(release): checking a task should mark the item used through Convex.
  const [checked, setChecked] = useState<string[]>([]);

  const toggle = (id: string) => {
    setChecked((current) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id]));
  };

  return (
    <section className="daily-list" aria-label="Use soon list">
      {items.map((item, index) => {
        const isChecked = checked.includes(item.id);
        const label = daysLeftLabel(item.expiresAt, now);
        const note = label === "today" ? "goes off today" : `good for ${label}`;
        return (
          <label className={`daily-task ${isChecked ? "is-checked" : ""}`} key={item.id}>
            <input type="checkbox" checked={isChecked} onChange={() => toggle(item.id)} />
            <span className="large-check" aria-hidden="true">
              {isChecked ? "✓" : ""}
            </span>
            <span className="task-number">0{index + 1}</span>
            <FoodArt name={item.name} className="task-icon" />
            <span className="task-copy">
              <strong>use up {item.name}</strong>
              <small>
                <span className="desktop-task-note">{note}</span>
                <span className="mobile-task-note">{note}</span>
              </small>
            </span>
          </label>
        );
      })}
    </section>
  );
}
