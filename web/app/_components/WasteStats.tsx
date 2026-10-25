"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Leekly } from "@/app/_components/ui/Leekly";
import { FixedTag } from "@/app/_components/ui/StatusTag";

type Totals = {
  centsWasted: number;
  centsSaved: number;
  missingPrice: boolean; // some wasted items have no price, so $ wasted is a floor
  streakDays: number;
  usedRate: number | null; // null when nothing was used or tossed
};
type Week = { start: number; centsWasted: number; usedRate: number | null };

const FIRST_DRAW_MS = 1400;
const REPLAY_DRAW_MS = 1000;
const STAGGER_MS = 200;
const DAY = 24 * 60 * 60 * 1000;

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const percent = (rate: number | null) => (rate === null ? "-" : `${Math.round(rate * 100)}%`);

// A null value shows a dash, for a rate with nothing to divide.
function StatCircle({
  value: shownValue,
  decimals = 0,
  prefix = "",
  suffix = "",
  innerUnit,
  delay,
  label,
  mobileLabel,
  secondary,
  positiveNote,
  progress = 1,
  tooltip,
  positive = false,
}: {
  value: number | null;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  innerUnit?: string;
  delay: number;
  label: string;
  mobileLabel?: string;
  secondary?: string;
  positiveNote?: string;
  progress?: number; // share of the ring drawn, for a rate
  tooltip: string;
  positive?: boolean;
}) {
  const value = shownValue ?? 0;
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
        <svg className={progress < 1 ? "is-partial" : ""} viewBox="0 0 300 300" aria-hidden="true">
          <path
            key={draw.key}
            className={`circle-stroke ${draw.active ? "is-animating" : ""}`}
            style={{
              animationDuration: `${draw.duration}ms`,
              animationDelay: `${draw.delay}ms`,
              strokeDasharray: progress < 1 ? `${900 * progress} 900` : undefined,
            }}
            d="M153 12C224 9 283 65 288 137C294 211 239 278 165 287C91 296 24 247 13 174C2 101 48 33 119 16C133 12 145 11 158 13C166 14 171 16 177 20"
          />
        </svg>
        <strong className={prefix ? "is-currency" : ""}>
          {shownValue === null ? "-" : `${prefix}${display}${suffix}`}
          {innerUnit && <small>{innerUnit}</small>}
        </strong>
      </span>
      <span className="stat-label">
        <span className="desktop-stat-label">{label}</span>
        <span className="mobile-stat-label">{mobileLabel ?? label}</span>
      </span>
      {secondary && <span className="stat-secondary">{secondary}</span>}
      {positiveNote && <span className="stat-positive-note">{positiveNote}</span>}
      {showTooltip && <span className="stat-tooltip">{tooltip}</span>}
    </button>
  );
}

export function StatCircles({ totals }: { totals: Totals }) {
  return (
    <section className="stats-screen">
      <StatCircle
        value={totals.centsWasted / 100}
        decimals={2}
        prefix="$"
        delay={0}
        label="$ wasted"
        secondary="last 4 weeks"
        positiveNote={totals.centsSaved > 0 ? `${dollars(totals.centsSaved)} saved` : undefined}
        tooltip={
          totals.missingPrice
            ? "at least this much tossed in the last 4 weeks; some items have no price"
            : "food tossed in the last 4 weeks, at its price"
        }
      />
      <StatCircle
        value={totals.streakDays}
        delay={STAGGER_MS}
        label="no-waste streak"
        mobileLabel="day streak"
        innerUnit={totals.streakDays === 1 ? "day" : "days"}
        tooltip="days since you last tossed food or left an expired card unswiped"
        positive
      />
      <StatCircle
        value={totals.usedRate === null ? null : Math.round(totals.usedRate * 100)}
        suffix="%"
        delay={STAGGER_MS * 2}
        label="use rate"
        progress={totals.usedRate ?? 0}
        tooltip="share of finished items you used instead of tossing, last 4 weeks"
        positive
      />
    </section>
  );
}

const mascotPose = typeof window === "undefined" || Math.random() < 0.5 ? "cool" : "number-one";
const noSubscribe = () => () => {};

// One random pose per page load; the server renders none so hydration matches. A zero-waste month earns the cool leek.
export function StatsMascot({ zeroWaste }: { zeroWaste: boolean }) {
  const randomPose = useSyncExternalStore(noSubscribe, () => mascotPose, () => null);
  const pose = zeroWaste ? "cool" : randomPose;
  return (
    <div className="stats-leek-preview">
      {pose && <Leekly pose={pose} className="stats-mascot" />}
      {zeroWaste && <FixedTag className="zero-waste-tag">zero-waste leek</FixedTag>}
    </div>
  );
}

const shortDate = (time: number) =>
  new Date(time).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toLowerCase();

// "oct 5–11", or "sep 28–oct 4" across a month.
function weekLabel(start: number, index: number): string {
  if (index === 0) return "this week";
  if (index === 1) return "last week";
  const [from, to] = [shortDate(start), shortDate(start + 6 * DAY)];
  const [fromMonth] = from.split(" ");
  const [toMonth, toDay] = to.split(" ");
  return fromMonth === toMonth ? `${from}–${toDay}` : `${from}–${to}`;
}

export function PeriodTable({ weeks }: { weeks: Week[] }) {
  return (
    <div className="thin-list week-list">
      <div className="thin-row list-labels">
        <span>week</span>
        <span>$ wasted</span>
        <span>use rate</span>
      </div>
      {weeks.map((week, index) => (
        <div className="thin-row" key={week.start}>
          <strong>{weekLabel(week.start, index)}</strong>
          <span>{dollars(week.centsWasted)}</span>
          <span>{percent(week.usedRate)}</span>
        </div>
      ))}
    </div>
  );
}
