"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { ItemView } from "@/convex/items";
import { splitFoodName } from "@/lib/foodName";
import { endOfLocalDay, freshness, statusTiming, type Freshness } from "@/lib/freshness";
import type { Location } from "@/lib/referenceMerge";
import type { SourcedText } from "@/lib/types";
import { FoodArt } from "@/app/_components/ui/FoodArt";
import { LocationPicker } from "@/app/_components/ui/LocationPicker";
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
// Phones: a drag past this share of the row's width commits on release.
const SWIPE_COMMIT = 0.35;
const SWIPE_EXIT_MS = 180;

const shortDate = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toLowerCase();

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
  onToss,
  onReviewExpired,
  onSetDate,
  onMove,
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
  onToss: () => void;
  onReviewExpired: () => void;
  onSetDate: (expiresAt: number) => void;
  onMove: (location: Location) => void;
}) {
  const status = freshness(item.expiresAt, now);
  const isExpired = status === "expired";
  const transition = useStatusTransition(status);
  const timing = statusTiming(item.expiresAt, now);
  // The swipe card needs the backend's expired status; the cron sets it up to an hour after the date passes.
  const needsReview = item.status === "expired";
  const { base, detail } = splitFoodName(item.name);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  // A ref, so moves that land before the next render still see the drag; horizontal stays null until the gesture picks an axis.
  const drag = useRef<{ x: number; y: number; width: number; horizontal: boolean | null } | null>(null);
  const swiped = useRef(false);

  // Touch only: left marks used, right tosses; a vertical move hands the gesture back to scrolling.
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "touch") return;
    swiped.current = false;
    drag.current = { x: event.clientX, y: event.clientY, width: event.currentTarget.offsetWidth || 1, horizontal: null };
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current) return;
    const moveX = event.clientX - current.x;
    const moveY = event.clientY - current.y;
    if (current.horizontal === null) {
      if (Math.abs(moveX) > 8 && Math.abs(moveX) > Math.abs(moveY)) {
        current.horizontal = true;
        swiped.current = true;
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      } else if (Math.abs(moveY) > 8) {
        drag.current = null;
        return;
      }
    }
    if (current.horizontal) setDx(moveX);
  };
  const onPointerUp = () => {
    const current = drag.current;
    drag.current = null;
    if (!current?.horizontal) return;
    setDragging(false);
    if (Math.abs(dx) < current.width * SWIPE_COMMIT) return setDx(0);
    const used = dx < 0;
    setDx(used ? -current.width : current.width);
    window.setTimeout(used ? onMarkUsed : onToss, SWIPE_EXIT_MS);
  };

  return (
    <article
      className={`food-card food-card--${status} ${isExpired ? "expired-surface food-art-surface--dark" : ""} ${transition ? `is-${transition}` : ""} ${expanded ? "is-expanded" : ""} ${filteredOut ? "is-filtered-out" : ""} ${highlighted ? "is-newly-added" : ""}`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <div className="card-swipe">
        {/* Grows from the side the row slides away from; touch only, so mouse users keep the buttons below. */}
        <span
          className={`card-swipe-reveal ${dx < 0 ? "is-used" : "is-toss"}`}
          style={{ width: Math.abs(dx) }}
          aria-hidden="true"
        >
          <span>{dx < 0 ? "✓ used" : "toss"}</span>
        </span>
        <button
          className="card-summary"
          onClick={checkIn ? onReviewExpired : onToggle}
          onClickCapture={(event) => {
            // A swipe ends with a click; it should not also open the row.
            if (!swiped.current) return;
            swiped.current = false;
            event.stopPropagation();
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={dx === 0 ? undefined : { transform: `translateX(${dx}px)`, transition: dragging ? "none" : undefined }}
          aria-expanded={expanded}
        >
          <span className="food-icon-slot">
            <FoodArt name={item.name} className="food-icon" />
          </span>
          <span className="card-info">
            <span className="card-title" title={item.name}>
              {base}
              {detail && <span className="card-title-detail">{detail}</span>}
            </span>
            <span className="card-meta">
              <StatusTag status={status} />
              {timing && <span className="status-timing">{timing}</span>}
              {extended && <span className="extended-tag">extended</span>}
              {checkIn && <span className="check-in-tag">check in</span>}
            </span>
          </span>
          <span className="expand-mark">{expanded ? "−" : "+"}</span>
        </button>
      </div>
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
          {/* A move never rescues a passed date, so expired items skip the choice. */}
          {!isExpired && (
            <div className="card-location">
              <LocationPicker value={item.location} label={`where ${item.name} is stored`} onPick={onMove} />
              {item.expiresAt !== undefined && <span>good until {shortDate(item.expiresAt)}</span>}
            </div>
          )}
          <button className={`used-button ${needsReview ? "" : "used-button--mark"}`} onClick={needsReview ? onReviewExpired : onMarkUsed}>
            {needsReview ? "review expired item" : "mark as used"}
          </button>
          {/* Phones swap the button for the row swipe; this tells them how. */}
          <p className="swipe-row-hint">swipe the row left if used, right to toss</p>
        </div>
      </div>
    </article>
  );
}
