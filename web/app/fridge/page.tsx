"use client";

import { useState } from "react";
import { sortByUrgency } from "@/lib/freshness";
import type { FridgeItem } from "@/lib/types";
import { demoFridge, demoFullness } from "@/app/_demo/fixtures";
import { EmptyState } from "@/app/_components/EmptyState";
import { FoodList } from "@/app/_components/FoodList";
import { FullnessPreview, fullnessLabels } from "@/app/_components/FullnessPreview";
import { SwipeTakeover } from "@/app/_components/SwipeTakeover";
import { Leekly } from "@/app/_components/ui/Leekly";
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
        <FullnessPreview {...demoFullness} />
        <div className="fridge-title">
          <p className="eyebrow">sorted by urgency</p>
          <h1>everything in my fridge.</h1>
          <p className="stock-label">{fullnessLabels[demoFullness.stage]}</p>
        </div>
        <p className="item-count">{String(items.length).padStart(2, "0")} items</p>
      </section>
      {items.length === 0 ? (
        <EmptyState message="your fridge is ready for something fresh." />
      ) : (
        <FoodList
          items={items}
          now={now}
          onMarkUsed={resolve}
          onReviewExpired={setReviewing}
          aside={<Leekly pose="point" className="leek-point fridge-leek-point" />}
        />
      )}
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
