"use client";

import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";

// centsWasted is null when that friend keeps their dollars private.
type Entry = {
  userId: Id<"users">;
  name: string;
  usedRate: number | null;
  centsWasted: number | null;
  streakDays: number;
  isYou: boolean;
};

const dollars = (cents: number | null) => (cents === null ? "private" : `$${(cents / 100).toFixed(2)}`);

export function Leaderboard({ entries, onRemove }: { entries: Entry[]; onRemove: (entry: Entry) => void }) {
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
        // The remove button sits beside the row button, since a button cannot hold another.
        <div className={`friend-row ${expanded === entry.userId ? "is-expanded" : ""}`} key={entry.userId}>
          <button
            type="button"
            className={`thin-row friend-columns ${entry.isYou ? "is-you" : ""} ${expanded === entry.userId ? "is-expanded" : ""}`}
            aria-expanded={expanded === entry.userId}
            onClick={() => setExpanded((current) => (current === entry.userId ? null : entry.userId))}
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
            <span aria-hidden="true" />
            <span className="friend-mobile-detail">
              $ wasted <strong>{dollars(entry.centsWasted)}</strong>
            </span>
          </button>
          {!entry.isYou && (
            <button
              type="button"
              className="friend-remove"
              aria-label={`remove ${entry.name} from friends`}
              title="remove friend"
              onClick={() => onRemove(entry)}
            >
              <span className="friend-remove-desktop" aria-hidden="true">
                ×
              </span>
              <span className="friend-remove-mobile" aria-hidden="true">
                remove friend
              </span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
