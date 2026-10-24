import { demoStats } from "@/app/_demo/fixtures";
import { StatCircles, WeekTable } from "@/app/_components/WasteStats";
import { Leekly } from "@/app/_components/ui/Leekly";

export default function StatsPage() {
  // TODO(release): read from the p1-03 waste stats query instead of demo fixtures.
  return (
    <main className="stats-page">
      <section className="compact-heading stats-heading">
        <h1>your numbers.</h1>
        <Leekly className="stats-mascot" />
      </section>
      <StatCircles totals={demoStats.totals} />
      <WeekTable weeks={demoStats.weeks} />
    </main>
  );
}
