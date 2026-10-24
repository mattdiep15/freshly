import type { ItemView } from "@/convex/items";
import { daysAgoLabel, daysLeftLabel, endOfLocalDay, expiredLabel, freshness } from "@/lib/freshness";
import type { SourcedText } from "@/lib/types";
import { FoodArt } from "@/app/_components/ui/FoodArt";
import { SourceNote } from "@/app/_components/ui/SourceNote";
import { StatusPill } from "@/app/_components/ui/StatusPill";

function DetailLine({ label, value, missing }: { label: string; value?: SourcedText | null; missing: string }) {
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

// Undated items never expire on their own, and packaged ones should use the printed date.
function DateForm({ item, onSetDate }: { item: ItemView; onSetDate: (expiresAt: number) => void }) {
  return (
    <form
      className="date-form"
      onSubmit={(event) => {
        event.preventDefault();
        const date = new FormData(event.currentTarget).get("date");
        if (typeof date === "string" && date) onSetDate(endOfLocalDay(date));
      }}
    >
      <label>
        {item.expiresAt === undefined ? "no sourced shelf life. set a date." : "check the date on the package."}
        <input type="date" name="date" required aria-label={`date for ${item.name}`} />
      </label>
      <button className="outline-button">set date</button>
    </form>
  );
}

export function FoodCard({
  item,
  now,
  expanded,
  filteredOut = false,
  extended = false,
  checkIn = false,
  onToggle,
  onHover,
  onMarkUsed,
  onReviewExpired,
  onSetDate,
}: {
  item: ItemView;
  now: number;
  expanded: boolean;
  filteredOut?: boolean;
  extended?: boolean;
  checkIn?: boolean;
  onToggle: () => void;
  onHover: () => void;
  onMarkUsed: () => void;
  onReviewExpired: () => void;
  onSetDate: (expiresAt: number) => void;
}) {
  const status = freshness(item.expiresAt, now);
  const isExpired = status === "expired";
  // The swipe card needs the backend's expired status; the cron sets it up to an hour after the date passes.
  const needsReview = item.status === "expired";

  return (
    <article
      className={`food-card food-card--${status} ${expanded ? "is-expanded" : ""} ${filteredOut ? "is-filtered-out" : ""}`}
      onMouseEnter={onHover}
    >
      <button
        className="card-summary"
        onClick={checkIn ? onReviewExpired : onToggle}
        aria-expanded={expanded}
      >
        <FoodArt name={item.name} className="food-icon" />
        <span className="card-info">
          <span className="card-title">{item.name}</span>
          <span className="card-meta">
            {isExpired && item.expiresAt !== undefined ? (
              <span className="status-pill">
                <span className="expired-label-desktop">{expiredLabel(item.expiresAt, now)}</span>
                <span className="expired-label-mobile">expired</span>
              </span>
            ) : (
              <StatusPill status={status} />
            )}
            {extended && <span className="extended-tag">extended</span>}
            {isExpired && item.expiresAt !== undefined ? (
              <span className="expired-days-mobile">{daysAgoLabel(item.expiresAt, now)}</span>
            ) : (
              <span className="days-left">{daysLeftLabel(item.expiresAt, now)}</span>
            )}
            {checkIn && <span className="check-in-tag">check in</span>}
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
        <div className="card-actions">
          {(item.expiresAt === undefined || item.checkLabel) && <DateForm item={item} onSetDate={onSetDate} />}
          <button className="used-button" onClick={needsReview ? onReviewExpired : onMarkUsed}>
            {needsReview ? "review expired item" : "mark as used"}
          </button>
        </div>
      </div>
    </article>
  );
}
