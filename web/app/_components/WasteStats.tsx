"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Leekly } from "@/app/_components/ui/Leekly";

type Totals = { rescued: number; lbsWasted: number; streakDays: number };
type Week = { label: string; rescued: number; lbsWasted: number };

const FIRST_DRAW_MS = 1400;
const REPLAY_MS = 1000;

function StatCircle({ finalValue, decimals = 0, initialDelay, label, tooltip, positive = false }: {
  finalValue: number;
  decimals?: number;
  initialDelay: number;
  label: string;
  tooltip: string;
  positive?: boolean;
}) {
  const zero = decimals ? (0).toFixed(decimals) : "0";
  const [displayValue, setDisplayValue] = useState(zero);
  const [draw, setDraw] = useState({ key: 0, duration: 0, delay: 0, active: false });
  const [showTooltip, setShowTooltip] = useState(false);
  const frame = useRef<number | null>(null);

  const animate = (duration: number, delay: number) => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(finalValue.toFixed(decimals));
      setDraw((current) => ({ ...current, active: false }));
      return;
    }

    setDisplayValue(zero);
    setDraw((current) => ({ key: current.key + 1, duration, delay, active: true }));
    const startsAt = performance.now() + delay;
    const tick = (time: number) => {
      const progress = Math.max(0, Math.min((time - startsAt) / duration, 1));
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = finalValue * eased;
      setDisplayValue(progress === 1 || decimals ? value.toFixed(decimals) : String(Math.floor(value)));
      frame.current = progress < 1 ? requestAnimationFrame(tick) : null;
    };
    frame.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    frame.current = requestAnimationFrame(() => animate(FIRST_DRAW_MS, initialDelay));
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
    // Count in once on mount; replays come from hover and tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const replay = () => {
    animate(REPLAY_MS, 0);
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
        <strong>{displayValue}</strong>
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
        finalValue={totals.rescued}
        initialDelay={0}
        label="items rescued"
        tooltip="foods you finished before they expired"
        positive
      />
      <StatCircle
        finalValue={totals.lbsWasted}
        decimals={1}
        initialDelay={200}
        label="lbs wasted"
        tooltip="estimated food discarded this month"
      />
      <StatCircle
        finalValue={totals.streakDays}
        initialDelay={400}
        label="day streak"
        tooltip="days in a row with no expired food"
        positive
      />
    </section>
  );
}

// One random pose per page load; null on the server so hydration matches.
const clientPose = typeof window === "undefined" ? null : Math.random() < 0.5 ? "cool" : "number-one";
const noSubscribe = () => () => {};

export function StatsLeek() {
  const pose = useSyncExternalStore(noSubscribe, () => clientPose, () => null);
  return <div className="stats-leek-preview">{pose && <Leekly pose={pose} className="stats-mascot" />}</div>;
}

export function WeekTable({ weeks }: { weeks: Week[] }) {
  return (
    <div className="thin-list week-list">
      <div className="thin-row list-labels">
        <span>week</span>
        <span>
          <span className="desktop-table-label">items rescued</span>
          <span className="mobile-table-label">rescued</span>
        </span>
        <span>
          <span className="desktop-table-label">lbs wasted</span>
          <span className="mobile-table-label">lbs</span>
        </span>
      </div>
      {weeks.map((week) => (
        <div className="thin-row" key={week.label}>
          <strong>{week.label}</strong>
          <span>{week.rescued}</span>
          <span>
            {week.lbsWasted}
            <span className="desktop-unit"> lbs</span>
          </span>
        </div>
      ))}
    </div>
  );
}
