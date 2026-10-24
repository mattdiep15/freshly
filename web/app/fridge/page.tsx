"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { ItemView } from "@/convex/items";
import { EXTENSION_DAYS } from "@/lib/extension";
import { expiredLabel, freshness, sortByUrgency } from "@/lib/freshness";
import { demoFullness } from "@/app/_demo/fixtures";
import { EmptyState } from "@/app/_components/EmptyState";
import { FoodList } from "@/app/_components/FoodList";
import { FullnessPreview, fullnessLabels } from "@/app/_components/FullnessPreview";
import { SwipeTakeover, type SwipeResult } from "@/app/_components/SwipeTakeover";
import { Leekly } from "@/app/_components/ui/Leekly";
import { useDelayedCommit } from "@/app/_components/useDelayedCommit";
import { useNow } from "@/app/_components/useNow";

const UNDO_WINDOW_MS = 5000;
const QUIET_TOAST_MS = 2000;

// reviews.pending adds the extension fields; active items have nothing left to extend into.
type FridgeRow = ItemView & { canExtend?: boolean; extendsTo?: number | null };
type Decision = { item: FridgeRow; result: SwipeResult };

const toastText: Record<SwipeResult, string> = {
  used: "marked as used.",
  wasted: "tossed.",
  extended: `extended up to ${EXTENSION_DAYS} days.`,
};

// A mutation on an item resolved elsewhere throws; the live queries drop it either way.
const ignoreStale = () => {};

export default function FridgePage() {
  const now = useNow();
  const active = useQuery(api.items.list, { status: "active" });
  const pendingReviews = useQuery(api.reviews.pending);
  const settings = useQuery(api.profiles.settings);
  const resolve = useMutation(api.items.resolve);
  const extend = useMutation(api.items.extend);
  const update = useMutation(api.itemEdits.update);
  // Session only: the backend does not record which items were extended or put off.
  const [extendedIds, setExtendedIds] = useState<string[]>([]);
  const [checkInIds, setCheckInIds] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState<FridgeRow | null>(null);
  const [quietToast, setQuietToast] = useState<string | null>(null);

  const { pending, queue, undo } = useDelayedCommit<Decision>(({ item, result }) => {
    if (result === "extended") {
      setExtendedIds((ids) => [...ids, item._id]);
      extend({ itemId: item._id }).catch(ignoreStale);
    } else {
      resolve({ itemId: item._id, outcome: result }).catch(ignoreStale);
    }
  }, UNDO_WINDOW_MS);

  if (now === null || active === undefined || pendingReviews === undefined || settings === undefined) {
    return <main className="fridge-screen" aria-busy="true" />;
  }

  // A pending decision already shows its outcome; undo puts the item back.
  const rows: FridgeRow[] = [...active, ...pendingReviews];
  const visible = rows
    .filter((item) => pending?.item._id !== item._id || pending.result === "extended")
    .map((item) =>
      pending?.item._id === item._id && item.extendsTo ? { ...item, expiresAt: item.extendsTo } : item,
    );
  const items = sortByUrgency(visible, now);
  const shownExtendedIds = [...extendedIds, ...(pending?.result === "extended" ? [pending.item._id] : [])];

  const decide = (item: FridgeRow, result: SwipeResult) => {
    setCheckInIds((ids) => ids.filter((id) => id !== item._id));
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
          extendedIds={shownExtendedIds}
          checkInIds={checkInIds}
          onMarkUsed={(item) => decide(item, "used")}
          onReviewExpired={setReviewing}
          onSetDate={(item, expiresAt) => update({ itemId: item._id, expiresAt }).catch(ignoreStale)}
        />
      )}
      {reviewing && (
        <SwipeTakeover
          item={reviewing}
          expiredText={reviewing.expiresAt === undefined ? "expired" : expiredLabel(reviewing.expiresAt, now)}
          canExtend={reviewing.canExtend === true}
          alwaysAskSpoiled={settings.alwaysAskSpoiled}
          onResolve={(result) => decide(reviewing, result)}
          onBack={() => {
            setCheckInIds((ids) => (ids.includes(reviewing._id) ? ids : [...ids, reviewing._id]));
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
