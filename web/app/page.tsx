"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { numberWord, pickUseSoon, USE_SOON_DAYS } from "@/lib/freshness";
import { UseSoonList } from "@/app/_components/UseSoonList";
import { Leekly } from "@/app/_components/ui/Leekly";
import { useNow } from "@/app/_components/useNow";

export default function HomePage() {
  const now = useNow();
  const useSoon = useQuery(api.items.useSoon, { days: USE_SOON_DAYS });
  const resolve = useMutation(api.items.resolve);
  if (now === null || useSoon === undefined) return <main className="home-screen" aria-busy="true" />;

  const items = pickUseSoon(useSoon, now);
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
          <span className="add-label">
            <span>add an</span> <span>item</span>
          </span>
        </Link>
      </section>

      <UseSoonList
        items={items}
        now={now}
        onUse={(item) => {
          // An item resolved elsewhere throws here; the live query drops it either way.
          resolve({ itemId: item._id, outcome: "used" }).catch(() => {});
        }}
      />

      <Link className="quiet-link" href="/fridge">
        everything in my fridge <span>→</span>
      </Link>
    </main>
  );
}
