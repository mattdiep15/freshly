type Entry = { name: string; lbsWasted: number; streakDays: number; isYou: boolean };

export function Leaderboard({ entries }: { entries: Entry[] }) {
  return (
    <div className="thin-list friends-list">
      <div className="thin-row list-labels friend-columns">
        <span>rank</span>
        <span>name</span>
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
          <span>
            {entry.lbsWasted}
            <span className="desktop-unit"> lbs</span>
          </span>
          <span>
            {entry.streakDays}
            <span className="desktop-unit"> days</span>
          </span>
          {/* TODO(release): swap the placeholder for the designer's friend drawing. */}
          <span className="friend-drawing" aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}
