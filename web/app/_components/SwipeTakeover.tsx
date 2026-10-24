"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { EXTENSION_DAYS } from "@/lib/extension";
import { daysAgoLabel } from "@/lib/freshness";
import type { FridgeItem } from "@/lib/types";
import { FoodArt } from "@/app/_components/ui/FoodArt";
import { SourceNote } from "@/app/_components/ui/SourceNote";
import { StatusPill } from "@/app/_components/ui/StatusPill";

export type SwipeDecision = "used" | "wasted" | "extended";
type Direction = "left" | "right";

// A drag past this share of the card width counts as a swipe.
const SWIPE_SHARE = 0.4;
const EXIT_MS = 250;
const STAMP_MS = 300;
const CLOSE_MS = 200;

export function SwipeTakeover({
  item,
  now,
  extended,
  onDecision,
  onBack,
}: {
  item: FridgeItem;
  now: number;
  // An item already extended once skips the spoilage step: left means tossed.
  extended: boolean;
  onDecision: (decision: SwipeDecision) => void;
  onBack: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [exit, setExit] = useState<Direction | null>(null);
  const [entry, setEntry] = useState<Direction | null>(null);
  const [closing, setClosing] = useState(false);
  const [visitedStepTwo, setVisitedStepTwo] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [hasSwiped, setHasSwiped] = useState(false);
  const [stamp, setStamp] = useState<Direction | null>(null);
  const [cardWidth, setCardWidth] = useState(1);
  const dragStart = useRef<number | null>(null);

  const ago = item.expiresAt !== undefined ? daysAgoLabel(item.expiresAt, now) : "";

  const finish = (direction: Direction) => {
    setDragX(0);
    setStamp(direction);
    setExit(direction);
    window.setTimeout(() => {
      if (step === 1 && direction === "right") onDecision("used");
      else if (step === 1 && !extended) {
        setVisitedStepTwo(true);
        setStep(2);
        setExit(null);
        setEntry("right");
        setStamp(null);
      } else if (step === 2 && direction === "right") onDecision("extended");
      else onDecision("wasted");
    }, EXIT_MS);
  };

  const choose = (direction: Direction) => {
    if (exit || stamp) return;
    setStamp(direction);
    window.setTimeout(() => finish(direction), STAMP_MS);
  };

  const goBack = () => {
    if (exit || closing) return;
    if (step === 2) {
      setExit("right");
      window.setTimeout(() => {
        setStep(1);
        setExit(null);
        setEntry("left");
      }, EXIT_MS);
    } else {
      setClosing(true);
      window.setTimeout(onBack, CLOSE_MS);
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") goBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // Let the buttons inside the card receive normal clicks.
    if (exit || (event.target as HTMLElement).closest("button")) return;
    dragStart.current = event.clientX - dragX;
    setCardWidth(event.currentTarget.offsetWidth || 1);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return;
    const next = event.clientX - dragStart.current;
    setDragX(next);
    if (Math.abs(next) > 8) setHasSwiped(true);
  };

  const release = () => {
    if (dragStart.current === null) return;
    dragStart.current = null;
    if (Math.abs(dragX) >= cardWidth * SWIPE_SHARE) finish(dragX > 0 ? "right" : "left");
    else {
      setDragX(0);
      setStamp(null);
    }
  };

  const rotation = Math.max(-8, Math.min(8, (dragX / cardWidth) * 16));
  const stampOpacity = Math.min(Math.abs(dragX) / (cardWidth * SWIPE_SHARE), 1);

  return (
    <div className="swipe-takeover" role="dialog" aria-modal="true">
      <div
        key={step}
        className={`swipe-card swipe-card--step-${step} ${exit ? `swipe-${exit}` : ""} ${entry ? `swipe-enter-${entry}` : ""} ${closing ? "swipe-close" : ""}`}
        style={!exit && !closing ? { transform: `translateX(${dragX}px) rotate(${rotation}deg)` } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
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
        <span
          className="swipe-stamp swipe-stamp--right"
          style={{ opacity: stamp === "right" ? 1 : dragX > 0 ? stampOpacity : 0 }}
        >
          {step === 2 ? "extended" : "used"}
        </span>

        {step === 1 ? (
          <>
            <StatusPill status="expired" />
            <p>{item.name}</p>
            <FoodArt name={item.name} className="swipe-food-art" />
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
              <StatusPill status="expired" />
              <p className="spoil-food-name">{item.name}</p>
              <div className="spoil-food-art">
                <FoodArt name={item.name} className="swipe-food-art swipe-food-art--check" />
              </div>
              <p className="spoil-expiry">expired {ago}</p>
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
              <p className="spoil-hint">our dates are cautious estimates. trust your eyes and nose.</p>
              <div className="swipe-actions">
                <button className="used-choice" onClick={() => choose("right")}>
                  <span className="swipe-label-desktop">no, {EXTENSION_DAYS} more days →</span>
                  <span className="swipe-label-mobile">{EXTENSION_DAYS} more days →</span>
                </button>
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
