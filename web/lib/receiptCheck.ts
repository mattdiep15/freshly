const DAY = 24 * 60 * 60 * 1000;

// A receipt older than this is more likely a misread year than a real upload.
export const MAX_RECEIPT_AGE_DAYS = 60;

export type ReviewFlag = "implausible_date" | "store_mismatch" | "date_mismatch" | "total_mismatch";

export type ReceiptHeader = { storeName: string | null; purchasedAt: string | null; totalCents: number | null };

// The printed date when it is plausible, else the upload time; a misread year would date every item wrong.
export function purchaseDate(
  printed: string | null,
  uploadedAt: number,
): { purchasedAt: number; printedAt: number | null; implausible: boolean } {
  const parsed = printed ? Date.parse(printed) : NaN;
  if (Number.isNaN(parsed)) return { purchasedAt: uploadedAt, printedAt: null, implausible: false };
  // One day of slack, since the printed date is local and the upload time is UTC.
  const implausible = parsed > uploadedAt + DAY || parsed < uploadedAt - MAX_RECEIPT_AGE_DAYS * DAY;
  return implausible
    ? { purchasedAt: uploadedAt, printedAt: null, implausible: true }
    : { purchasedAt: parsed, printedAt: parsed, implausible: false };
}

const normStore = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Fields where two readings of the same receipt disagree; a field one reader left blank is not a disagreement, except the date.
export function headerMismatches(a: ReceiptHeader, b: ReceiptHeader): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  if (a.storeName && b.storeName) {
    const [x, y] = [normStore(a.storeName), normStore(b.storeName)];
    if (!x.includes(y) && !y.includes(x)) flags.push("store_mismatch");
  }
  if ((a.purchasedAt ?? null) !== (b.purchasedAt ?? null)) flags.push("date_mismatch");
  if (a.totalCents !== null && b.totalCents !== null && a.totalCents !== b.totalCents) flags.push("total_mismatch");
  return flags;
}
