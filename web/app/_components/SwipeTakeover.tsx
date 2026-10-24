"use client";

import { useEffect, useState, type PointerEvent } from "react";
import type { SourcedText } from "@/lib/types";
import { FoodArt } from "@/app/_components/ui/FoodArt";
import { SourceNote } from "@/app/_components/ui/SourceNote";
import { StatusTag } from "@/app/_components/ui/StatusTag";

export type SwipeResult = "used" | "wasted" | "extended";
type Direction = "left" | "right";

// A drag past this share of the card width counts as a swipe.
const SWIPE_THRESHOLD = 0.4;
const EXIT_ANIMATION_MS = 250;
const CLOSE_ANIMATION_MS = 200;
// A tapped or keyed answer shows its stamp this long before the card leaves.
const STAMP_MS = 300;

export function SwipeTakeover({
  item,
  timing,
  canExtend,
  alwaysAskSpoiled,
  onResolve,
  onBack,
}: {
  item: { name: string; freshnessHint?: SourcedText | null };
  // "2 days ago" or "today"; null when the item has no date.
  timing: string | null;
  // False when there is no sourced shelf life left to extend into, or it was already extended.
  canExtend: boolean;
  // Shows card 2 with only "toss" when canExtend is false (a user setting, handy for demos).
  alwaysAskSpoiled: boolean;
  onResolve: (result: SwipeResult) => void;
  onBack: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [exit, setExit] = useState<Direction | null>(null);
  const [entry, setEntry] = useState<Direction | null>(null);
  const [closing, setClosing] = useState(false);
  const [visitedStepTwo, setVisitedStepTwo] = useState(false);
  const [dragX, setDragX] = useState(0);
  // Pointer x where the drag began, and the card width the threshold is measured against.
  const [drag, setDrag] = useState<{ start: number; width: number } | null>(null);
  const [hasSwiped, setHasSwiped] = useState(false);
  const [stamp, setStamp] = useState<Direction | null>(null);
  const busy = exit !== null || closing;
  // Card 2 without days to give has only "toss"; a right swipe there springs back.
  const blocked = (direction: Direction) => step === 2 && direction === "right" && !canExtend;

  const finish = (direction: Direction) => {
    if (busy) return;
    setDragX(0);
    if (blocked(direction)) return;
    setStamp(direction);
    setExit(direction);
    window.setTimeout(() => {
      if (step === 1 && direction === "right") onResolve("used");
      else if (step === 1 && (canExtend || alwaysAskSpoiled)) {
        setVisitedStepTwo(true);
        setStep(2);
        setExit(null);
        setEntry("right");
        setStamp(null);
      } else if (step === 2 && direction === "right") onResolve("extended");
      else onResolve("wasted");
    }, EXIT_ANIMATION_MS);
  };

  const choose = (direction: Direction) => {
    if (busy || stamp || blocked(direction)) return;
    setStamp(direction);
    window.setTimeout(() => finish(direction), STAMP_MS);
  };

  const goBack = () => {
    if (busy || stamp) return;
    if (step === 2) {
      setExit("right");
      window.setTimeout(() => {
        setStep(1);
        setExit(null);
        setEntry("left");
      }, EXIT_ANIMATION_MS);
    } else {
      setClosing(true);
      window.setTimeout(onBack, CLOSE_ANIMATION_MS);
    }
  };

  // Re-subscribes every render so the handlers see the current step.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") goBack();
      if (event.key === "ArrowLeft") choose("left");
      if (event.key === "ArrowRight") choose("right");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // Let the buttons inside the card receive normal clicks.
    if (busy || stamp || (event.target as HTMLElement).closest("button")) return;
    setDrag({ start: event.clientX - dragX, width: event.currentTarget.offsetWidth || 1 });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag === null) return;
    const next = event.clientX - drag.start;
    setDragX(next);
    if (Math.abs(next) > 8) setHasSwiped(true);
  };

  const onPointerUp = () => {
    if (drag === null) return;
    setDrag(null);
    if (Math.abs(dragX) >= drag.width * SWIPE_THRESHOLD) finish(dragX > 0 ? "right" : "left");
    else setDragX(0);
  };

  const rotation = drag ? Math.max(-8, Math.min(8, (dragX / drag.width) * 16)) : 0;
  const stampOpacity = drag ? Math.min(Math.abs(dragX) / (drag.width * SWIPE_THRESHOLD), 1) : 0;
  const dragStyle = busy
    ? undefined
    : {
        transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
        transition: drag ? "none" : undefined,
      };

  const classes = [
    "swipe-card",
    `swipe-card--step-${step}`,
    exit ? `swipe-${exit}` : "",
    entry ? `swipe-enter-${entry}` : "",
    closing ? "swipe-close" : "",
  ].join(" ");

  return (
    <div className="swipe-takeover" role="dialog" aria-modal="true" aria-label={`check in on ${item.name}`}>
      <div
        key={step}
        className={classes}
        style={dragStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <button type="button" className="swipe-back" onClick={goBack}>
          <span>←</span> back
        </button>
        <span className={`swipe-progress ${step === 1 && !visitedStepTwo ? "is-hidden" : ""}`}>{step} of 2</span>
        <span
          className={`swipe-stamp swipe-stamp--left ${step === 2 ? "" : "swipe-stamp--wasted"}`}
          style={{ opacity: stamp === "left" ? 1 : dragX < 0 ? stampOpacity : 0 }}
        >
          {step === 2 ? "toss" : "wasted"}
        </span>
        <span className="swipe-stamp swipe-stamp--right" style={{ opacity: stamp === "right" ? 1 : dragX > 0 && !blocked("right") ? stampOpacity : 0 }}>
          {step === 2 ? "extended" : "used"}
        </span>

        {step === 1 ? (
          <>
            <div className="swipe-food-panel">
              <span className="swipe-status-meta">
                <StatusTag status="expired" />
                {timing && <span className="status-timing">{timing}</span>}
              </span>
              <p>{item.name}</p>
              <FoodArt name={item.name} className="swipe-food-art" />
            </div>
            <h1>did you use it?</h1>
            <div className="swipe-actions">
              <button onClick={() => choose("left")}>← wasted</button>
              <button className="used-choice" onClick={() => choose("right")}>
                used →
              </button>
            </div>
            <small className={`mobile-swipe-hint ${hasSwiped ? "is-hidden" : ""}`}>swipe left or right</small>
          </>
        ) : (
          <>
            <span className="swipe-kicker">one more check</span>
            <div className="spoil-food-column">
              <span className="swipe-status-meta">
                <StatusTag status="expired" />
                {timing && <span className="status-timing">{timing}</span>}
              </span>
              <p className="spoil-food-name">{item.name}</p>
              <div className="spoil-food-art">
                <FoodArt name={item.name} className="swipe-food-art swipe-food-art--check" />
              </div>
              <p className="spoil-expiry">{timing ? `expired ${timing}` : "expired"}</p>
            </div>
            <div className="spoil-question-column">
              <h1>does it look spoiled?</h1>
              <div className="spoil-check-box">
                <strong>check</strong>
                {item.freshnessHint ? (
                  <>
                    <p>{item.freshnessHint.text}</p>
                    <SourceNote source={item.freshnessHint.source} />
                  </>
                ) : (
                  <p className="detail-missing">no sourced freshness hint yet.</p>
                )}
              </div>
              <p className="spoil-hint">
                {canExtend
                  ? "our dates are cautious estimates. trust your eyes and nose."
                  : "it's past the longest time our source gives, so we can't add days."}
              </p>
              <div className="swipe-actions">
                {canExtend && (
                  <button className="used-choice" onClick={() => choose("right")}>
                    <span className="swipe-label-desktop">no, 1-2 more days →</span>
                    <span className="swipe-label-mobile">1-2 more days →</span>
                  </button>
                )}
                <button onClick={() => choose("left")}>
                  <span className="swipe-label-desktop">← yes, toss :(</span>
                  <span className="swipe-label-mobile">← toss it</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      <small className={hasSwiped ? "is-hidden" : ""}>swipe left or right</small>
    </div>
  );
}
