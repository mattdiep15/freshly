import { daysLeftLabel, freshness } from "@/lib/freshness";
import type { FridgeItem, SourcedText } from "@/lib/types";
import { SourceNote } from "@/app/_components/ui/SourceNote";
import { StatusPill } from "@/app/_components/ui/StatusPill";

function DetailLine({ label, value, missing }: { label: string; value?: SourcedText; missing: string }) {
  return (
    <div className="detail-line">
      <span>{label}</span>
      {value ? (
        <>
          <p>{value.text}</p>
          <SourceNote source={value.source} />
        </>
      ) : (
        <p className="detail-missing">{missing}</p>
      )}
    </div>
  );
}

export function FoodCard({
  item,
  now,
  expanded,
  onToggle,
  onHover,
  onMarkUsed,
  onReviewExpired,
}: {
  item: FridgeItem;
  now: number;
  expanded: boolean;
  onToggle: () => void;
  onHover: () => void;
  onMarkUsed: () => void;
  onReviewExpired: () => void;
}) {
  const status = freshness(item.expiresAt, now);
  const isExpired = status === "expired";

  return (
    <article
      className={`food-card food-card--${status} ${expanded ? "is-expanded" : ""}`}
      onMouseEnter={onHover}
    >
      <button className="card-summary" onClick={onToggle} aria-expanded={expanded}>
        <StatusPill status={status} />
        <span className="card-title">{item.name}</span>
        <span className="days-left">{daysLeftLabel(item.expiresAt, now)}</span>
        <span className="expand-mark">{expanded ? "−" : "+"}</span>
      </button>
      <div className="card-details">
        {/* TODO(release): swap the placeholder for the designer's per-food illustration. */}
        <div className="illustration-slot">
          <span>custom illustration</span>
          <strong>[{item.name}]</strong>
        </div>
        <DetailLine label="store" value={item.storageTip} missing="no sourced storage tip yet." />
        <DetailLine label="check" value={item.freshnessHint} missing="no sourced freshness hint yet." />
        <button className="used-button" onClick={isExpired ? onReviewExpired : onMarkUsed}>
          {isExpired ? "review expired item" : "mark as used"}
        </button>
      </div>
    </article>
  );
}
