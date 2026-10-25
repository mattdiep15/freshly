"use client";

import { useState } from "react";

// centsWasted is null when that friend keeps their dollars private.
type Entry = { name: string; usedRate: number | null; centsWasted: number | null; streakDays: number; isYou: boolean };

const dollars = (cents: number | null) => (cents === null ? "private" : `$${(cents / 100).toFixed(2)}`);

export function Leaderboard({ entries }: { entries: Entry[] }) {
  // Phones hide the $ column; tapping a row shows it underneath.
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="thin-list friends-list">
      <div className="thin-row list-labels friend-columns">
        <span>rank</span>
        <span>name</span>
        <span>use rate</span>
        <span>streak</span>
        <span>$ wasted</span>
        <span aria-hidden="true" />
      </div>
      {entries.map((entry, index) => (
        <button
          type="button"
          className={`thin-row friend-columns ${entry.isYou ? "is-you" : ""} ${expanded === entry.name ? "is-expanded" : ""}`}
          key={entry.name}
          aria-expanded={expanded === entry.name}
          onClick={() => setExpanded((current) => (current === entry.name ? null : entry.name))}
        >
          <span>{String(index + 1).padStart(2, "0")}</span>
          <strong>{entry.name}</strong>
          {/* The board sorts on this, so it is always shown; "-" means nothing resolved this week. */}
          <span>{entry.usedRate === null ? "-" : `${Math.round(entry.usedRate * 100)}%`}</span>
          <span>
            {entry.streakDays}
            <span className="desktop-unit"> {entry.streakDays === 1 ? "day" : "days"}</span>
          </span>
          <span>{dollars(entry.centsWasted)}</span>
          {/* TODO(release): swap the placeholder for the designer's friend drawing. */}
          <span className="friend-drawing" aria-hidden="true" />
          <span className="friend-mobile-detail">
            $ wasted <strong>{dollars(entry.centsWasted)}</strong>
          </span>
        </button>
      ))}
    </div>
  );
}
