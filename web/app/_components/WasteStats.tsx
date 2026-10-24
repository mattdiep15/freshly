"use client";

import { useEffect, useState } from "react";

type Totals = { rescued: number; lbsWasted: number; streakDays: number };
type Week = { label: string; rescued: number; lbsWasted: number };

const COUNT_IN_DELAY_MS = 250;

function StatCircle({ value, label, tooltip, positive = false }: {
  value: string;
  label: string;
  tooltip: string;
  positive?: boolean;
}) {
  const [drawKey, setDrawKey] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);

  const redraw = () => {
    setDrawKey((key) => key + 1);
    setShowTooltip(true);
  };

  return (
    <button
      className={`stat-circle ${positive ? "positive" : ""}`}
      onMouseEnter={redraw}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={redraw}
    >
      <span className="circle-art">
        <svg viewBox="0 0 300 300" aria-hidden="true">
          <path
            key={drawKey}
            className="circle-stroke"
            d="M153 12C224 9 283 65 288 137C294 211 239 278 165 287C91 296 24 247 13 174C2 101 48 33 119 16C133 12 145 11 158 13C166 14 171 16 177 20"
          />
        </svg>
        <strong>{value}</strong>
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
  const [counted, setCounted] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setCounted(true), COUNT_IN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const show = (value: number) => (counted ? String(value) : "00");

  return (
    <section className="stats-screen">
      <StatCircle
        value={show(totals.rescued)}
        label="items rescued"
        tooltip="foods you finished before they expired"
        positive
      />
      <StatCircle
        value={show(totals.lbsWasted)}
        label="lbs wasted"
        tooltip="estimated food discarded this month"
      />
      <StatCircle
        value={show(totals.streakDays)}
        label="day streak"
        tooltip="days in a row with no expired food"
        positive
      />
    </section>
  );
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
