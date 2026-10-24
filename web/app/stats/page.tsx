import { demoStats } from "@/app/_demo/fixtures";
import { StatBlocks, WeekTable } from "@/app/_components/WasteStats";

export default function StatsPage() {
  // TODO(release): read from the p1-03 waste stats query instead of demo fixtures.
  return (
    <main className="stats-page">
      <section className="compact-heading">
        <p className="eyebrow">a quiet look back</p>
        <h1>your numbers.</h1>
      </section>
      <StatBlocks totals={demoStats.totals} />
      <WeekTable weeks={demoStats.weeks} />
    </main>
  );
}
