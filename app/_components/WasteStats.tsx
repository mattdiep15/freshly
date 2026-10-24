type Totals = { rescued: number; lbsWasted: number; streakDays: number };
type Week = { label: string; rescued: number; lbsWasted: number };

export function StatBlocks({ totals }: { totals: Totals }) {
  return (
    <section className="stats-screen">
      <div className="stat-block positive">
        <span>items rescued</span>
        <strong>{totals.rescued}</strong>
      </div>
      <div className="stat-block">
        <span>lbs wasted</span>
        <strong>{totals.lbsWasted}</strong>
      </div>
      <div className="stat-block positive">
        <span>day streak</span>
        <strong>{totals.streakDays}</strong>
      </div>
    </section>
  );
}

export function WeekTable({ weeks }: { weeks: Week[] }) {
  return (
    <div className="thin-list week-list">
      <div className="thin-row list-labels">
        <span>week</span>
        <span>items rescued</span>
        <span>lbs wasted</span>
      </div>
      {weeks.map((week) => (
        <div className="thin-row" key={week.label}>
          <strong>{week.label}</strong>
          <span>{week.rescued}</span>
          <span>{week.lbsWasted} lbs</span>
        </div>
      ))}
    </div>
  );
}
