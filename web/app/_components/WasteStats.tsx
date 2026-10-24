"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Leekly } from "@/app/_components/ui/Leekly";

// approximate is true when some wasted items have no weight, so lbs wasted is a floor.
type Totals = { rescued: number; lbsWasted: number; streakDays: number; approximate: boolean };
type Period = { label: string; rescued: number; lbsWasted: number; usedRate: number | null };

const FIRST_DRAW_MS = 1400;
const REPLAY_DRAW_MS = 1000;
const STAGGER_MS = 200;

function StatCircle({ value, decimals = 0, suffix = "", delay, label, tooltip, positive = false }: {
  value: number;
  decimals?: number;
  suffix?: string;
  delay: number;
  label: string;
  tooltip: string;
  positive?: boolean;
}) {
  const zero = (0).toFixed(decimals);
  const [display, setDisplay] = useState(zero);
  const [draw, setDraw] = useState({ key: 0, duration: 0, delay: 0, active: false });
  const [showTooltip, setShowTooltip] = useState(false);
  const frame = useRef<number | null>(null);

  const animate = useCallback(
    (duration: number, startDelay: number) => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setDisplay(value.toFixed(decimals));
        return;
      }
      setDisplay(zero);
      setDraw((current) => ({ key: current.key + 1, duration, delay: startDelay, active: true }));
      const startsAt = performance.now() + startDelay;
      const tick = (time: number) => {
        const progress = Math.min(Math.max((time - startsAt) / duration, 0), 1);
        // Ease-out cubic, so the count slows as the stroke closes.
        const eased = 1 - Math.pow(1 - progress, 3);
        const shown = decimals ? (value * eased).toFixed(decimals) : String(Math.floor(value * eased));
        setDisplay(progress === 1 ? value.toFixed(decimals) : shown);
        frame.current = progress < 1 ? requestAnimationFrame(tick) : null;
      };
      frame.current = requestAnimationFrame(tick);
    },
    [value, decimals, zero],
  );

  useEffect(() => {
    // Start on the next frame so the first paint shows zero before counting up.
    frame.current = requestAnimationFrame(() => animate(FIRST_DRAW_MS, delay));
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [animate, delay]);

  const replay = () => {
    animate(REPLAY_DRAW_MS, 0);
    setShowTooltip(true);
  };

  return (
    <button
      className={`stat-circle ${positive ? "positive" : ""}`}
      onMouseEnter={replay}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={replay}
    >
      <span className="circle-art">
        <svg viewBox="0 0 300 300" aria-hidden="true">
          <path
            key={draw.key}
            className={`circle-stroke ${draw.active ? "is-animating" : ""}`}
            style={{ animationDuration: `${draw.duration}ms`, animationDelay: `${draw.delay}ms` }}
            d="M153 12C224 9 283 65 288 137C294 211 239 278 165 287C91 296 24 247 13 174C2 101 48 33 119 16C133 12 145 11 158 13C166 14 171 16 177 20"
          />
        </svg>
        <strong>
          {display}
          {suffix}
        </strong>
      </span>
      <span className="stat-label">
        {label.split(" ").map((word, index) => (
          <span key={word}>
            {index > 0 && <br className="mobile-stat-break" />}
            {word}
            {index === 0 && <span className="desktop-stat-space"> </span>}
          </span>
        ))}
      </span>
      {showTooltip && <span className="stat-tooltip">{tooltip}</span>}
    </button>
  );
}

export function StatCircles({ totals }: { totals: Totals }) {
  return (
    <section className="stats-screen">
      <StatCircle
        value={totals.rescued}
        delay={0}
        label="items rescued"
        tooltip="foods you marked as used this month"
        positive
      />
      <StatCircle
        value={totals.lbsWasted}
        decimals={1}
        delay={STAGGER_MS}
        label="lbs wasted"
        tooltip={totals.approximate ? "at least this much food discarded this month; some items have no weight" : "estimated food discarded this month"}
      />
      <StatCircle
        value={totals.streakDays}
        delay={STAGGER_MS * 2}
        label="day streak"
        tooltip="days since you last tossed food or left an expired card unswiped"
        positive
      />
    </section>
  );
}

const mascotPose = typeof window === "undefined" || Math.random() < 0.5 ? "cool" : "number-one";
const noSubscribe = () => () => {};

// One random pose per page load; the server renders none so hydration matches.
export function StatsMascot() {
  const pose = useSyncExternalStore(noSubscribe, () => mascotPose, () => null);
  return <div className="stats-leek-preview">{pose && <Leekly pose={pose} className="stats-mascot" />}</div>;
}

export function PeriodTable({ periods }: { periods: Period[] }) {
  return (
    <div className="thin-list week-list">
      <div className="thin-row list-labels">
        <span>period</span>
        <span>
          <span className="desktop-table-label">items rescued</span>
          <span className="mobile-table-label">rescued</span>
        </span>
        <span>
          <span className="desktop-table-label">lbs wasted</span>
          <span className="mobile-table-label">lbs</span>
        </span>
        <span>
          <span className="desktop-table-label">% used</span>
          <span className="mobile-table-label">used</span>
        </span>
      </div>
      {periods.map((period) => (
        <div className="thin-row" key={period.label}>
          <strong>{period.label}</strong>
          <span>{period.rescued}</span>
          <span>
            {period.lbsWasted.toFixed(1)}
            <span className="desktop-unit"> lbs</span>
          </span>
          <span>{period.usedRate === null ? "-" : `${Math.round(period.usedRate * 100)}%`}</span>
        </div>
      ))}
    </div>
  );
}
