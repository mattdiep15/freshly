"use client";

import { useState } from "react";
import type { FridgeItem } from "@/lib/types";
import { FoodCard } from "@/app/_components/FoodCard";

const COLLAPSED_COUNT = 4;

export function FoodList({
  items,
  now,
  onMarkUsed,
  onReviewExpired,
}: {
  items: FridgeItem[];
  now: number;
  onMarkUsed: (item: FridgeItem) => void;
  onReviewExpired: (item: FridgeItem) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, COLLAPSED_COUNT);

  return (
    <>
      <div className="food-list">
        {visible.map((item) => (
          <FoodCard
            key={item.id}
            item={item}
            now={now}
            expanded={expanded === item.id}
            onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
            onHover={() => setExpanded(item.id)}
            onMarkUsed={() => onMarkUsed(item)}
            onReviewExpired={() => onReviewExpired(item)}
          />
        ))}
      </div>
      {!showAll && items.length > COLLAPSED_COUNT && (
        <button className="quiet-link centered" onClick={() => setShowAll(true)}>
          see all {items.length} <span>→</span>
        </button>
      )}
    </>
  );
}
