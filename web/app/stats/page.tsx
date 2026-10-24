import { demoStats } from "@/app/_demo/fixtures";
import { StatCircles, StatsMascot, WeekTable } from "@/app/_components/WasteStats";

export default function StatsPage() {
  // TODO(release): read from the p1-03 waste stats query instead of demo fixtures.
  return (
    <main className="stats-page">
      <section className="compact-heading stats-heading">
        <StatsMascot />
        <h1>your numbers.</h1>
      </section>
      <StatCircles totals={demoStats.totals} />
      <WeekTable weeks={demoStats.weeks} />
    </main>
  );
}
