"use client";

import { useEffect, useRef, useState } from "react";
import type { ItemView } from "@/convex/items";
import { endOfLocalDay, freshness, statusTiming, type Freshness } from "@/lib/freshness";
import type { SourcedText } from "@/lib/types";
import { FoodArt } from "@/app/_components/ui/FoodArt";
import { SourceNote } from "@/app/_components/ui/SourceNote";
import { StatusTag } from "@/app/_components/ui/StatusTag";

function DetailLine({ label, value, missing }: { label: string; value?: SourcedText | null; missing: string }) {
  return (
    <div className="detail-line">
      <span>{label}</span>
      {value ? (
        <>
          <p>{value.text}</p>
          <SourceNote source={value.source} />
        </>
      ) : (
        <p className="detail-missing">{missing}</p>
      )}
    </div>
  );
}

// Undated items never expire on their own, and packaged ones should use the printed date.
function DateForm({ item, onSetDate }: { item: ItemView; onSetDate: (expiresAt: number) => void }) {
  return (
    <form
      className="date-form"
      onSubmit={(event) => {
        event.preventDefault();
        const date = new FormData(event.currentTarget).get("date");
        if (typeof date === "string" && date) onSetDate(endOfLocalDay(date));
      }}
    >
      <label>
        {item.expiresAt === undefined ? "no sourced shelf life. set a date." : "check the date on the package."}
        <input type="date" name="date" required aria-label={`date for ${item.name}`} />
      </label>
      <button className="outline-button">set date</button>
    </form>
  );
}

const STATUS_TRANSITION_MS = 400;

// Animates a row that crosses into or out of expired while it is on screen.
function useStatusTransition(status: Freshness) {
  const previous = useRef(status);
  const [transition, setTransition] = useState<"expiring" | "restoring" | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = status;
    if (before === status) return;
    const next = status === "expired" ? "expiring" : before === "expired" ? "restoring" : null;
    if (!next) return;
    setTransition(next);
    const timer = window.setTimeout(() => setTransition(null), STATUS_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [status]);
  return transition;
}

export function FoodCard({
  item,
  now,
  expanded,
  filteredOut = false,
  extended = false,
  checkIn = false,
  highlighted = false,
  onToggle,
  onHover,
  onLeave,
  onMarkUsed,
  onReviewExpired,
  onSetDate,
}: {
  item: ItemView;
  now: number;
  expanded: boolean;
  filteredOut?: boolean;
  extended?: boolean;
  checkIn?: boolean;
  highlighted?: boolean;
  onToggle: () => void;
  onHover: () => void;
  onLeave: () => void;
  onMarkUsed: () => void;
  onReviewExpired: () => void;
  onSetDate: (expiresAt: number) => void;
}) {
  const status = freshness(item.expiresAt, now);
  const isExpired = status === "expired";
  const transition = useStatusTransition(status);
  const timing = statusTiming(item.expiresAt, now);
  // The swipe card needs the backend's expired status; the cron sets it up to an hour after the date passes.
  const needsReview = item.status === "expired";

  return (
    <article
      className={`food-card food-card--${status} ${isExpired ? "expired-surface food-art-surface--dark" : ""} ${transition ? `is-${transition}` : ""} ${expanded ? "is-expanded" : ""} ${filteredOut ? "is-filtered-out" : ""} ${highlighted ? "is-newly-added" : ""}`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <button
        className="card-summary"
        onClick={checkIn ? onReviewExpired : onToggle}
        aria-expanded={expanded}
      >
        <span className="food-icon-slot">
          <FoodArt name={item.name} className="food-icon" />
        </span>
        <span className="card-info">
          <span className="card-title">{item.name}</span>
          <span className="card-meta">
            <StatusTag status={status} />
            {timing && <span className="status-timing">{timing}</span>}
            {extended && <span className="extended-tag">extended</span>}
            {checkIn && <span className="check-in-tag">check in</span>}
          </span>
        </span>
        <span className="expand-mark">{expanded ? "−" : "+"}</span>
      </button>
      <div className="card-details">
        <div className="detail-main">
          <div className="illustration-slot">
            <FoodArt name={item.name} className="expanded-food-icon" />
          </div>
          <div className="detail-copy">
            <DetailLine label="store" value={item.storageTip} missing="no sourced storage tip yet." />
            <DetailLine label="check" value={item.freshnessHint} missing="no sourced freshness hint yet." />
          </div>
        </div>
        <div className="card-actions">
          {(item.expiresAt === undefined || item.checkLabel) && <DateForm item={item} onSetDate={onSetDate} />}
          <button className="used-button" onClick={needsReview ? onReviewExpired : onMarkUsed}>
            {needsReview ? "review expired item" : "mark as used"}
          </button>
        </div>
      </div>
    </article>
  );
}
