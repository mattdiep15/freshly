"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ItemView } from "@/convex/items";
import { freshness, groupByLocation } from "@/lib/freshness";
import type { Location } from "@/lib/referenceMerge";
import { FoodCard } from "@/app/_components/FoodCard";
import { Leekly } from "@/app/_components/ui/Leekly";

type StatusFilter = "expired" | "soon" | "fresh";
type FridgeFilter = "all" | StatusFilter;

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

// Hover-to-open is a desktop affordance; on touch it would fight the tap toggle.
const hoverOpens = () => window.matchMedia("(min-width: 768px)").matches;

export function FoodList({
  items,
  now,
  extendedIds,
  checkInIds,
  highlightedIds,
  onMarkUsed,
  onReviewExpired,
  onSetDate,
  onMove,
}: {
  items: ItemView[];
  now: number;
  extendedIds: readonly string[];
  checkInIds: readonly string[];
  highlightedIds: readonly string[];
  onMarkUsed: (item: ItemView) => void;
  onReviewExpired: (item: ItemView) => void;
  onSetDate: (item: ItemView, expiresAt: number) => void;
  onMove: (item: ItemView, location: Location) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<FridgeFilter>("all");
  const [filterCompact, setFilterCompact] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Undated items have no filter tab; they show only under "all".
  const counts: Record<StatusFilter, number> = { expired: 0, soon: 0, fresh: 0 };
  for (const item of items) {
    const status = freshness(item.expiresAt, now);
    if (status !== "unknown") counts[status] += 1;
  }
  const visibleCount = filter === "all" ? items.length : counts[filter];
  const urgent = counts.expired + counts.soon;

  const changeFilter = (next: FridgeFilter) => {
    setExpanded(null);
    setFilter(next === filter ? "all" : next);
  };

  // Mobile only: the filter bar shrinks to one line once it sticks to the top of the page scroller.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const scroller = sentinel?.closest(".mobile-page-scroll");
    if (!sentinel || !scroller) return;

    const update = () => {
      if (window.innerWidth >= 768) return setFilterCompact(false);
      setFilterCompact(sentinel.getBoundingClientRect().top <= scroller.getBoundingClientRect().top);
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
            <div className="fridge-count-copy">
              <strong>{filter === "all" ? `${items.length} items` : `${visibleCount} ${filterLabels[filter]}`}</strong>
              {filter !== "all" && (
                <button type="button" onClick={() => changeFilter("all")}>
                  clear
                </button>
              )}
            </div>
            <Link className="fridge-add-item" href="/scan">
              + add item
            </Link>
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
        {/* A section whose items are all filtered out drops its heading and border too. */}
        {groupByLocation(items).map(({ location, items: group }) => {
          const shown =
            filter === "all" ? group.length : group.filter((item) => freshness(item.expiresAt, now) === filter).length;
          if (shown === 0) return null;
          return (
            <section className="location-section" key={location} aria-label={location}>
              <h2 className="location-heading">
                {location} <span>{shown}</span>
              </h2>
              <div className="food-list">
                {group.map((item) => (
                  <FoodCard
                    key={item._id}
                    item={item}
                    now={now}
                    expanded={expanded === item._id}
                    filteredOut={filter !== "all" && freshness(item.expiresAt, now) !== filter}
                    extended={extendedIds.includes(item._id)}
                    checkIn={checkInIds.includes(item._id)}
                    highlighted={highlightedIds.includes(item._id)}
                    onToggle={() => setExpanded(expanded === item._id ? null : item._id)}
                    onHover={() => {
                      if (hoverOpens()) setExpanded(item._id);
                    }}
                    onLeave={() => {
                      if (hoverOpens()) setExpanded((id) => (id === item._id ? null : id));
                    }}
                    onMarkUsed={() => onMarkUsed(item)}
                    onReviewExpired={() => onReviewExpired(item)}
                    onSetDate={(expiresAt) => onSetDate(item, expiresAt)}
                    onMove={(location) => onMove(item, location)}
                  />
                ))}
              </div>
            </section>
          );
        })}
        {filter !== "all" && visibleCount === 0 && (
          <div className="filter-empty-state">
            <Leekly className="filter-empty-leek" />
            <strong>nothing here.</strong>
            <p>{emptyMessages[filter]}</p>
          </div>
        )}
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
