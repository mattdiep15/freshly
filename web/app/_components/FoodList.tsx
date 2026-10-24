"use client";

import { useEffect, useRef, useState } from "react";
import { freshness } from "@/lib/freshness";
import type { FridgeItem } from "@/lib/types";
import { FoodCard } from "@/app/_components/FoodCard";
import { Leekly } from "@/app/_components/ui/Leekly";

export type FridgeFilter = "all" | "expired" | "soon" | "fresh";
type StatusFilter = Exclude<FridgeFilter, "all">;

const filterLabels: Record<FridgeFilter, string> = {
  all: "all",
  expired: "expired",
  soon: "use soon",
  fresh: "fresh",
};

const emptyMessages: Record<StatusFilter, string> = {
  expired: "all clear!",
  soon: "nothing close to expiring.",
  fresh: "time to restock.",
};

export function FoodList({
  items,
  now,
  filter,
  onFilterChange,
  extendedIds,
  deferredIds,
  onMarkUsed,
  onReviewExpired,
}: {
  items: FridgeItem[];
  now: number;
  filter: FridgeFilter;
  onFilterChange: (filter: FridgeFilter) => void;
  extendedIds: string[];
  deferredIds: string[];
  onMarkUsed: (item: FridgeItem) => void;
  onReviewExpired: (item: FridgeItem) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterCompact, setFilterCompact] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const statusOf = (item: FridgeItem) => freshness(item.expiresAt, now);
  const counts: Record<StatusFilter, number> = { expired: 0, soon: 0, fresh: 0 };
  for (const item of items) {
    const status = statusOf(item);
    if (status !== "unknown") counts[status] += 1;
  }
  const visibleCount = filter === "all" ? items.length : counts[filter];
  const urgent = counts.expired + counts.soon;

  const changeFilter = (next: FridgeFilter) => {
    setExpanded(null);
    onFilterChange(next === filter ? "all" : next);
  };

  // Mobile only: the filter bar shrinks to one line once it sticks under the top bar.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const scroller = sentinel?.closest(".app-shell");
    if (!sentinel || !scroller) return;

    const update = () => {
      if (window.innerWidth >= 768) return setFilterCompact(false);
      const topbar = scroller.querySelector<HTMLElement>(".topbar");
      const stickyTop = scroller.getBoundingClientRect().top + (topbar?.offsetHeight ?? 0);
      setFilterCompact(sentinel.getBoundingClientRect().top <= stickyTop);
    };

    update();
    scroller.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      scroller.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div className="fridge-list-stage">
      <div className="fridge-list-main">
        <div className="fridge-count-header">
          <div className="fridge-count-title">
            <strong>
              {filter === "all" ? `${items.length} items` : `${visibleCount} ${filterLabels[filter]}`}
            </strong>
            {filter !== "all" && (
              <button type="button" onClick={() => changeFilter("all")}>
                clear
              </button>
            )}
          </div>
          <div className="filter-sticky-sentinel" ref={sentinelRef} aria-hidden="true" />
          <div
            className={`fridge-filter-tabs ${filterCompact ? "is-compact" : ""}`}
            role="group"
            aria-label="Filter fridge by status"
          >
            {(Object.keys(filterLabels) as FridgeFilter[]).map((option) => {
              const selected = filter === option;
              const count = option === "all" ? items.length : counts[option];
              return (
                <button
                  type="button"
                  key={option}
                  className={selected ? "is-selected" : ""}
                  disabled={option !== "all" && count === 0}
                  aria-pressed={selected}
                  onClick={() => changeFilter(option)}
                >
                  <span className="filter-tab-label">{filterLabels[option]}</span>
                  <span className="filter-tab-meta">
                    {option === "all" ? (
                      <span className="filter-marker-spacer" aria-hidden="true" />
                    ) : (
                      <span className={`filter-marker filter-marker--${option}`} aria-hidden="true" />
                    )}
                    <span className="filter-tab-count">{count}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="food-list">
          {items.map((item) => (
            <FoodCard
              key={item.id}
              item={item}
              now={now}
              expanded={expanded === item.id}
              filteredOut={filter !== "all" && statusOf(item) !== filter}
              extended={extendedIds.includes(item.id)}
              deferred={deferredIds.includes(item.id)}
              onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
              onHover={() => {
                // Hover-to-open is a desktop affordance; on touch it would fight the tap toggle.
                if (window.matchMedia("(min-width: 768px)").matches) setExpanded(item.id);
              }}
              onMarkUsed={() => onMarkUsed(item)}
              onReviewExpired={() => onReviewExpired(item)}
            />
          ))}
          {filter !== "all" && visibleCount === 0 && (
            <div className="filter-empty-state">
              <Leekly className="filter-empty-leek" />
              <strong>nothing here.</strong>
              <p>{emptyMessages[filter]}</p>
            </div>
          )}
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
