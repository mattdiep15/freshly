"use client";

import { useState } from "react";
import { EXTENSION_DAYS } from "@/lib/extension";
import { expiredLabel, freshness, sortByUrgency } from "@/lib/freshness";
import type { FridgeItem } from "@/lib/types";
import { demoFridge, demoFullness } from "@/app/_demo/fixtures";
import { EmptyState } from "@/app/_components/EmptyState";
import { FoodList } from "@/app/_components/FoodList";
import { FullnessPreview, fullnessLabels } from "@/app/_components/FullnessPreview";
import { SwipeTakeover, type SwipeResult } from "@/app/_components/SwipeTakeover";
import { Leekly } from "@/app/_components/ui/Leekly";
import { useDelayedCommit } from "@/app/_components/useDelayedCommit";
import { useNow } from "@/app/_components/useNow";

const DAY_MS = 24 * 60 * 60 * 1000;
const UNDO_WINDOW_MS = 5000;
const QUIET_TOAST_MS = 2000;

type Decision = { item: FridgeItem; result: SwipeResult };

const toastText: Record<SwipeResult, string> = {
  used: "marked as used.",
  wasted: "tossed.",
  extended: `extended ${EXTENSION_DAYS} days.`,
};

export default function FridgePage() {
  const now = useNow();
  // TODO(release): replace local state with the p1-03 resolve and extend mutations.
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);
  const [extendedUntil, setExtendedUntil] = useState<Record<string, number>>({});
  const [checkInIds, setCheckInIds] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState<FridgeItem | null>(null);
  const [quietToast, setQuietToast] = useState<string | null>(null);

  const { pending, queue, undo } = useDelayedCommit<Decision>(({ item, result }) => {
    if (result === "extended") {
      // TODO(release): items.extend caps this at the sourced range; the demo adds a flat 2 days.
      setExtendedUntil((current) => ({ ...current, [item.id]: Date.now() + EXTENSION_DAYS * DAY_MS }));
    } else {
      setResolvedIds((ids) => [...ids, item.id]);
    }
  }, UNDO_WINDOW_MS);

  if (now === null) return <main className="fridge-screen" aria-busy="true" />;

  // A pending decision already shows its outcome; undo puts the item back.
  const visible = demoFridge(now)
    .filter((item) => !resolvedIds.includes(item.id))
    .filter((item) => pending?.item.id !== item.id || pending.result === "extended")
    .map((item) => {
      const until = pending?.item.id === item.id ? now + EXTENSION_DAYS * DAY_MS : extendedUntil[item.id];
      return until === undefined ? item : { ...item, expiresAt: until };
    });
  const items = sortByUrgency(visible, now);
  const extendedIds = [...Object.keys(extendedUntil), ...(pending?.result === "extended" ? [pending.item.id] : [])];

  const decide = (item: FridgeItem, result: SwipeResult) => {
    setCheckInIds((ids) => ids.filter((id) => id !== item.id));
    setReviewing(null);
    queue({ item, result });
  };

  const undoDecision = () => {
    const decision = undo();
    // Undoing a swipe reopens its card; undoing "mark as used" just restores the item.
    if (decision && freshness(decision.item.expiresAt, now) === "expired") setReviewing(decision.item);
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
          extendedIds={extendedIds}
          checkInIds={checkInIds}
          onMarkUsed={(item) => decide(item, "used")}
          onReviewExpired={setReviewing}
        />
      )}
      {reviewing && (
        <SwipeTakeover
          item={reviewing}
          expiredText={reviewing.expiresAt === undefined ? "expired" : expiredLabel(reviewing.expiresAt, now)}
          // TODO(release): use reviews.pending's canExtend, which also checks the sourced range.
          canExtend={!extendedIds.includes(reviewing.id)}
          onResolve={(result) => decide(reviewing, result)}
          onBack={() => {
            setCheckInIds((ids) => (ids.includes(reviewing.id) ? ids : [...ids, reviewing.id]));
            setReviewing(null);
            setQuietToast("no worries, we'll ask again later");
            window.setTimeout(() => setQuietToast(null), QUIET_TOAST_MS);
          }}
        />
      )}
      {pending && (
        <button className="decision-toast" type="button" onClick={undoDecision}>
          {toastText[pending.result]} <u>undo</u>
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
