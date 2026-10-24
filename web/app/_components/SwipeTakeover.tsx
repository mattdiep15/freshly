"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { StatusPill } from "@/app/_components/ui/StatusPill";

export type SwipeResult = "used" | "wasted";

const SWIPE_THRESHOLD_PX = 120;
const EXIT_ANIMATION_MS = 650;

export function SwipeTakeover({
  itemName,
  onResolve,
}: {
  itemName: string;
  onResolve: (result: SwipeResult) => void;
}) {
  const [result, setResult] = useState<SwipeResult | null>(null);
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);

  const choose = useCallback(
    (choice: SwipeResult) => {
      setResult(choice);
      window.setTimeout(() => onResolve(choice), EXIT_ANIMATION_MS);
    },
    [onResolve],
  );

  useEffect(() => {
    if (result) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") choose("wasted");
      if (event.key === "ArrowRight") choose("used");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, result]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // Let the buttons inside the card receive normal clicks.
    if (result || (event.target as HTMLElement).closest("button")) return;
    startX.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (startX.current !== null) setDragX(event.clientX - startX.current);
  };

  const onPointerUp = () => {
    if (startX.current === null) return;
    startX.current = null;
    if (Math.abs(dragX) > SWIPE_THRESHOLD_PX) choose(dragX > 0 ? "used" : "wasted");
    setDragX(0);
  };

  const dragStyle =
    dragX !== 0 && !result
      ? { transform: `translateX(${dragX}px) rotate(${dragX / 20}deg)`, transition: "none" }
      : undefined;

  return (
    <div className={`swipe-takeover ${result ? `result-${result}` : ""}`} role="dialog" aria-modal="true">
      <p className="eyebrow">quick check-in</p>
      <div
        className={`swipe-card ${result ? `swipe-${result}` : ""}`}
        style={dragStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <StatusPill status="expired" />
        <p>{itemName}</p>
        <h1>{result === "used" ? "nice save." : result === "wasted" ? "noted." : "did you use it?"}</h1>
        {!result && (
          <div className="swipe-actions">
            <button onClick={() => choose("wasted")}>← wasted</button>
            <button className="used-choice" onClick={() => choose("used")}>
              used →
            </button>
          </div>
        )}
      </div>
      {!result && <small>swipe left or right</small>}
    </div>
  );
}
