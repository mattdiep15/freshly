import { daysAgoLabel, daysLeftLabel, freshness } from "@/lib/freshness";
import type { FridgeItem, SourcedText } from "@/lib/types";
import { FoodArt } from "@/app/_components/ui/FoodArt";
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
  filteredOut = false,
  extended = false,
  deferred = false,
  onToggle,
  onHover,
  onMarkUsed,
  onReviewExpired,
}: {
  item: FridgeItem;
  now: number;
  expanded: boolean;
  filteredOut?: boolean;
  extended?: boolean;
  deferred?: boolean;
  onToggle: () => void;
  onHover: () => void;
  onMarkUsed: () => void;
  onReviewExpired: () => void;
}) {
  const status = freshness(item.expiresAt, now);
  const isExpired = status === "expired";
  const ago = isExpired && item.expiresAt !== undefined ? daysAgoLabel(item.expiresAt, now) : "";

  return (
    <article
      className={`food-card food-card--${status} ${expanded ? "is-expanded" : ""} ${filteredOut ? "is-filtered-out" : ""}`}
      onMouseEnter={onHover}
    >
      <button
        className="card-summary"
        onClick={deferred ? onReviewExpired : onToggle}
        aria-expanded={expanded}
      >
        <FoodArt name={item.name} className="food-icon" />
        <span className="card-info">
          <span className="card-title">{item.name}</span>
          <span className="card-meta">
            {isExpired ? (
              <span className="status-pill">
                <span className="expired-label-desktop">expired {ago}</span>
                <span className="expired-label-mobile">expired</span>
              </span>
            ) : (
              <StatusPill status={status} />
            )}
            {extended && <span className="extended-tag">extended</span>}
            {isExpired ? (
              <span className="expired-days-mobile">{ago}</span>
            ) : (
              <span className="days-left">{daysLeftLabel(item.expiresAt, now)}</span>
            )}
            {deferred && <span className="check-in-tag">check in</span>}
          </span>
        </span>
        <span className="expand-mark">{expanded ? "−" : "+"}</span>
      </button>
      <div className="card-details">
        <div className="illustration-slot">
          <FoodArt name={item.name} className="expanded-food-icon" />
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
