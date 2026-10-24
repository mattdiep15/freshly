type Entry = { name: string; usedRate: number | null; lbsWasted: number; streakDays: number; isYou: boolean };

export function Leaderboard({ entries }: { entries: Entry[] }) {
  return (
    <div className="thin-list friends-list">
      <div className="thin-row list-labels friend-columns">
        <span>rank</span>
        <span>name</span>
        <span>% used</span>
        <span>
          <span className="desktop-table-label">lbs wasted</span>
          <span className="mobile-table-label">lbs</span>
        </span>
        <span>streak</span>
        <span>drawing</span>
      </div>
      {entries.map((entry, index) => (
        <div className={`thin-row friend-columns ${entry.isYou ? "is-you" : ""}`} key={entry.name}>
          <span>0{index + 1}</span>
          <strong>{entry.name}</strong>
          {/* The board sorts on this, so it is always shown; "-" means nothing resolved this week. */}
          <span>{entry.usedRate === null ? "-" : `${Math.round(entry.usedRate * 100)}%`}</span>
          <span>
            {entry.lbsWasted}
            <span className="desktop-unit"> lbs</span>
          </span>
          <span>
            {entry.streakDays}
            <span className="desktop-unit"> {entry.streakDays === 1 ? "day" : "days"}</span>
          </span>
          {/* TODO(release): swap the placeholder for the designer's friend drawing. */}
          <span className="friend-drawing" aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}
