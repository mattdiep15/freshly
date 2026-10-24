"use client";

import { useState } from "react";
import { sortByUrgency } from "@/lib/freshness";
import type { FridgeItem } from "@/lib/types";
import { demoFridge } from "@/app/_demo/fixtures";
import { FoodList } from "@/app/_components/FoodList";
import { SwipeTakeover } from "@/app/_components/SwipeTakeover";
import { useNow } from "@/app/_components/useNow";

export default function FridgePage() {
  const now = useNow();
  // TODO(release): replace local state with the p1-03 resolve mutation.
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState<FridgeItem | null>(null);

  if (now === null) return <main className="fridge-screen" aria-busy="true" />;

  const items = sortByUrgency(
    demoFridge(now).filter((item) => !resolvedIds.includes(item.id)),
    now,
  );
  const resolve = (item: FridgeItem) => setResolvedIds((ids) => [...ids, item.id]);

  return (
    <main className="fridge-screen">
      <section className="page-heading">
        <div>
          <p className="eyebrow">sorted by urgency</p>
          <h1>everything in my fridge.</h1>
        </div>
        <p className="item-count">{String(items.length).padStart(2, "0")} items</p>
      </section>
      <FoodList items={items} now={now} onMarkUsed={resolve} onReviewExpired={setReviewing} />
      {reviewing && (
        <SwipeTakeover
          itemName={reviewing.name}
          onResolve={() => {
            resolve(reviewing);
            setReviewing(null);
          }}
        />
      )}
    </main>
  );
}
