"use client";

import { useEffect, useRef, useState } from "react";
import { EXTENSION_DAYS } from "@/lib/extension";
import { sortByUrgency } from "@/lib/freshness";
import type { FridgeItem } from "@/lib/types";
import { demoFridge, demoFullness } from "@/app/_demo/fixtures";
import { EmptyState } from "@/app/_components/EmptyState";
import { FoodList, type FridgeFilter } from "@/app/_components/FoodList";
import { FullnessPreview, fullnessLabels } from "@/app/_components/FullnessPreview";
import { SwipeTakeover, type SwipeDecision } from "@/app/_components/SwipeTakeover";
import { Leekly } from "@/app/_components/ui/Leekly";
import { useNow } from "@/app/_components/useNow";

const DAY_MS = 24 * 60 * 60 * 1000;
const UNDO_MS = 5000;
const QUIET_TOAST_MS = 2000;

const decisionToast: Record<SwipeDecision, string> = {
  used: "marked as used.",
  wasted: "tossed.",
  extended: `extended ${EXTENSION_DAYS} days.`,
};

export default function FridgePage() {
  const now = useNow();
  const [filter, setFilter] = useState<FridgeFilter>("all");
  // TODO(release): replace local state with the items.resolve / items.extend mutations.
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);
  const [extended, setExtended] = useState<Record<string, number>>({});
  const [deferredIds, setDeferredIds] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState<FridgeItem | null>(null);
  const [pending, setPending] = useState<{ decision: SwipeDecision; item: FridgeItem } | null>(null);
  const [quietToast, setQuietToast] = useState<string | null>(null);
  const undoTimer = useRef<number | undefined>(undefined);
  const quietTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(undoTimer.current);
      window.clearTimeout(quietTimer.current);
    },
    [],
  );

  if (now === null) return <main className="fridge-screen" aria-busy="true" />;

  const items = sortByUrgency(
    demoFridge(now)
      .filter((item) => !resolvedIds.includes(item.id))
      .map((item) => (extended[item.id] ? { ...item, expiresAt: extended[item.id] } : item)),
    now,
  );
  const without = (ids: string[], id: string) => ids.filter((other) => other !== id);
  const resolve = (item: FridgeItem) => setResolvedIds((ids) => [...ids, item.id]);

  const decide = (decision: SwipeDecision) => {
    if (!reviewing) return;
    const item = reviewing;
    if (decision === "extended") setExtended((map) => ({ ...map, [item.id]: now + EXTENSION_DAYS * DAY_MS }));
    else resolve(item);
    setDeferredIds((ids) => without(ids, item.id));
    setReviewing(null);
    setPending({ decision, item });
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setPending(null), UNDO_MS);
  };

  const undo = () => {
    if (!pending) return;
    const { decision, item } = pending;
    window.clearTimeout(undoTimer.current);
    if (decision === "extended") {
      setExtended((map) => Object.fromEntries(Object.entries(map).filter(([id]) => id !== item.id)));
    } else {
      setResolvedIds((ids) => without(ids, item.id));
    }
    setPending(null);
    setReviewing(item);
  };

  const defer = () => {
    if (!reviewing) return;
    const id = reviewing.id;
    setDeferredIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
    setReviewing(null);
    setQuietToast("no worries, we'll ask again later");
    window.clearTimeout(quietTimer.current);
    quietTimer.current = window.setTimeout(() => setQuietToast(null), QUIET_TOAST_MS);
  };

  return (
    <main className="fridge-screen">
      <section className="page-heading">
        <FullnessPreview {...demoFullness} />
        <div className="fridge-title">
          <div className="fridge-title-copy">
            <p className="eyebrow">sorted by urgency</p>
            <h1>everything in my fridge.</h1>
            <Leekly pose="point" className="mobile-fridge-leek" />
          </div>
          <p className="stock-label">{fullnessLabels[demoFullness.stage]}</p>
        </div>
      </section>
      {items.length === 0 ? (
        <EmptyState message="your fridge is ready for something fresh." />
      ) : (
        <FoodList
          items={items}
          now={now}
          filter={filter}
          onFilterChange={setFilter}
          extendedIds={Object.keys(extended)}
          deferredIds={deferredIds}
          onMarkUsed={resolve}
          onReviewExpired={setReviewing}
        />
      )}
      {reviewing && (
        <SwipeTakeover
          item={reviewing}
          now={now}
          extended={reviewing.id in extended}
          onDecision={decide}
          onBack={defer}
        />
      )}
      {pending && (
        <button className="decision-toast" type="button" onClick={undo}>
          {decisionToast[pending.decision]} <u>undo</u>
        </button>
      )}
      {quietToast && (
        <div className="extension-toast" role="status">
          {quietToast}
        </div>
      )}
    </main>
  );
}
