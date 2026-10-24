const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

// A receipt older than this is more likely a misread year than a real upload.
export const MAX_RECEIPT_AGE_DAYS = 60;

export type ReviewFlag = "implausible_date" | "store_mismatch" | "date_mismatch" | "total_mismatch";

export type ReceiptHeader = { storeName: string | null; purchasedAt: string | null; totalCents: number | null };

// Noon of a printed YYYY-MM-DD in the user's timezone: the purchase time is unknown, and noon keeps the printed day in every timezone.
export function receiptDayToMs(date: string | null, utcOffsetMinutes: number): number | null {
  const m = date?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) - utcOffsetMinutes * MINUTE;
}

// The printed date when it is plausible, else the upload time; a misread year would date every item wrong.
export function purchaseDate(
  printed: string | null,
  uploadedAt: number,
  utcOffsetMinutes: number,
): { purchasedAt: number; printedAt: number | null; implausible: boolean } {
  const parsed = receiptDayToMs(printed, utcOffsetMinutes);
  if (parsed === null) return { purchasedAt: uploadedAt, printedAt: null, implausible: false };
  // One day of slack, since noon on a receipt scanned that morning is still ahead of the upload.
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

// The verifier's date counts only when it passes the same plausibility check; its misread years flagged correct receipts.
export function verifierMismatches(
  main: ReceiptHeader,
  verifier: ReceiptHeader,
  uploadedAt: number,
  utcOffsetMinutes: number,
): ReviewFlag[] {
  const { implausible } = purchaseDate(verifier.purchasedAt, uploadedAt, utcOffsetMinutes);
  return headerMismatches(main, implausible ? { ...verifier, purchasedAt: main.purchasedAt } : verifier);
}
