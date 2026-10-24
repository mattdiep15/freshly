"use client";

import { useState } from "react";
import type { ItemView } from "@/convex/items";
import { freshness, type Freshness } from "@/lib/freshness";
import { FoodCard } from "@/app/_components/FoodCard";
import { Leekly } from "@/app/_components/ui/Leekly";

export function FoodList({
  items,
  now,
  extendedIds,
  checkInIds,
  onMarkUsed,
  onReviewExpired,
  onSetDate,
}: {
  items: ItemView[];
  now: number;
  extendedIds: readonly string[];
  checkInIds: readonly string[];
  onMarkUsed: (item: ItemView) => void;
  onReviewExpired: (item: ItemView) => void;
  onSetDate: (item: ItemView, expiresAt: number) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const counts: Record<Freshness, number> = { expired: 0, soon: 0, fresh: 0, unknown: 0 };
  for (const item of items) counts[freshness(item.expiresAt, now)] += 1;
  const urgent = counts.expired + counts.soon;

  return (
    <div className="fridge-list-stage">
      <div className="fridge-list-main">
        <div className="fridge-count-header">
          <strong>{items.length} items</strong>
          <span>
            {counts.expired} expired · {counts.soon} use soon · {counts.fresh} fresh
            {counts.unknown > 0 && ` · ${counts.unknown} no date`}
          </span>
        </div>
        <div className="food-list">
          {items.map((item) => (
            <FoodCard
              key={item._id}
              item={item}
              now={now}
              expanded={expanded === item._id}
              extended={extendedIds.includes(item._id)}
              checkIn={checkInIds.includes(item._id)}
              onToggle={() => setExpanded(expanded === item._id ? null : item._id)}
              onHover={() => {
                // Hover-to-open is a desktop affordance; on touch it would fight the tap toggle.
                if (window.matchMedia("(min-width: 768px)").matches) setExpanded(item._id);
              }}
              onMarkUsed={() => onMarkUsed(item)}
              onReviewExpired={() => onReviewExpired(item)}
              onSetDate={(expiresAt) => onSetDate(item, expiresAt)}
            />
          ))}
        </div>
      </div>
      <aside className="fridge-leek-gutter" aria-label="Fridge status">
        <div className={`fridge-status-bubble ${urgent === 0 ? "is-all-fresh" : ""}`}>
          {urgent === 0 ? "all fresh!" : `${counts.expired} expired, ${counts.soon} use soon`}
        </div>
        <Leekly pose="point" className="leek-point fridge-leek-point" />
      </aside>
    </div>
  );
}
