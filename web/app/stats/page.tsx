"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PeriodTable, StatCircles, StatsMascot } from "@/app/_components/WasteStats";

export default function StatsPage() {
  const week = useQuery(api.stats.summary, { range: "week" });
  const month = useQuery(api.stats.summary, { range: "month" });
  const all = useQuery(api.stats.summary, { range: "all" });
  if (!week || !month || !all) return <main className="stats-page" aria-busy="true" />;

  const periods = [
    { label: "this week", summary: week },
    { label: "this month", summary: month },
    { label: "all time", summary: all },
  ].map(({ label, summary }) => ({ label, rescued: summary.itemsUsed, lbsWasted: summary.wastedLbs }));

  return (
    <main className="stats-page">
      <section className="compact-heading stats-heading">
        <StatsMascot />
        <h1>your numbers.</h1>
      </section>
      <StatCircles
        totals={{
          rescued: month.itemsUsed,
          lbsWasted: month.wastedLbs,
          usedRate: month.usedRate,
          approximate: month.itemsMissingWeight > 0,
        }}
      />
      <PeriodTable periods={periods} />
    </main>
  );
}
