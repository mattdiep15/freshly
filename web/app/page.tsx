"use client";

import Link from "next/link";
import { numberWord, pickUseSoon } from "@/lib/freshness";
import { demoFridge } from "@/app/_demo/fixtures";
import { UseSoonList } from "@/app/_components/UseSoonList";
import { Leekly } from "@/app/_components/ui/Leekly";
import { useNow } from "@/app/_components/useNow";

export default function HomePage() {
  const now = useNow();
  if (now === null) return <main className="home-screen" aria-busy="true" />;

  // TODO(release): read from the p1-03 use-soon query instead of demo fixtures.
  const items = pickUseSoon(demoFridge(now), now);
  const today = new Date(now)
    .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    .toLowerCase();

  return (
    <main className="home-screen">
      <section className="home-intro">
        <div>
          <p className="eyebrow">{today}</p>
          <h1>use soon.</h1>
          <p className="hero-subtitle">
            {items.length === 0
              ? "nothing urgent today."
              : `${numberWord(items.length)} small ${items.length === 1 ? "thing" : "things"} to save today.`}
          </p>
        </div>
        <Leekly pose="fridge" className="home-mascot" />
        <Link className="add-button" href="/scan">
          <span className="add-symbol">+</span>
          <span className="add-label"><span>add an</span> <span>item</span></span>
        </Link>
      </section>

      <UseSoonList items={items} now={now} />

      <Link className="quiet-link" href="/fridge">
        everything in my fridge <span>→</span>
      </Link>
    </main>
  );
}
