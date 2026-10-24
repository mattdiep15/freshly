import { describe, expect, test } from "vitest";
import { localDateKey } from "./digest";
import { headerMismatches, purchaseDate, receiptDayToMs, verifierMismatches } from "./receiptCheck";

const HOUR = 60 * 60 * 1000;
const uploaded = Date.UTC(2026, 9, 24, 12);
const PDT = -420;
const TOKYO = 540;

describe("receiptDayToMs", () => {
  test("is noon of the printed day in the user's timezone", () => {
    expect(receiptDayToMs("2026-10-06", 0)).toBe(Date.UTC(2026, 9, 6, 12));
    expect(receiptDayToMs("2026-10-06", PDT)).toBe(Date.UTC(2026, 9, 6, 12) + 7 * HOUR);
  });

  test("keeps the printed day in timezones on both sides of UTC", () => {
    for (const offset of [PDT, 0, TOKYO]) {
      expect(localDateKey(receiptDayToMs("2026-10-06", offset)!, offset)).toBe("2026-10-06");
    }
  });

  test("rejects anything that is not YYYY-MM-DD", () => {
    expect(receiptDayToMs(null, 0)).toBeNull();
    expect(receiptDayToMs("10/06/2026", 0)).toBeNull();
    expect(receiptDayToMs("2026-10-06T00:00:00Z", 0)).toBeNull();
  });
});

describe("purchaseDate", () => {
  test("uses a printed date from the last few weeks", () => {
    const printed = receiptDayToMs("2026-10-15", PDT);
    expect(purchaseDate("2026-10-15", uploaded, PDT)).toEqual({ purchasedAt: printed, printedAt: printed, implausible: false });
  });

  test("falls back to the upload time with no printed date", () => {
    expect(purchaseDate(null, uploaded, PDT)).toEqual({ purchasedAt: uploaded, printedAt: null, implausible: false });
    expect(purchaseDate("not a date", uploaded, PDT).implausible).toBe(false);
  });

  test("flags a misread year in the past", () => {
    expect(purchaseDate("2023-10-15", uploaded, PDT)).toEqual({ purchasedAt: uploaded, printedAt: null, implausible: true });
  });

  test("flags a date in the future", () => {
    expect(purchaseDate("2027-10-15", uploaded, PDT).implausible).toBe(true);
  });

  test("allows a receipt dated today when scanned in the morning", () => {
    const morning = receiptDayToMs("2026-10-24", TOKYO)! - 5 * HOUR;
    expect(purchaseDate("2026-10-24", morning, TOKYO).implausible).toBe(false);
  });
});

describe("headerMismatches", () => {
  const claude = { storeName: "Costco", purchasedAt: "2026-10-06", totalCents: 11411 };

  test("agrees when one store name contains the other", () => {
    expect(headerMismatches(claude, { ...claude, storeName: "COSTCO WHOLESALE" })).toEqual([]);
  });

  test("flags each field that differs", () => {
    expect(headerMismatches(claude, { storeName: "Safeway", purchasedAt: "2023-10-06", totalCents: 11410 })).toEqual([
      "store_mismatch",
      "date_mismatch",
      "total_mismatch",
    ]);
  });

  test("ignores a blank store or total but not a blank date", () => {
    expect(headerMismatches(claude, { storeName: null, purchasedAt: null, totalCents: null })).toEqual(["date_mismatch"]);
    const cutOff = { storeName: null, purchasedAt: null, totalCents: 49657 };
    expect(headerMismatches(cutOff, cutOff)).toEqual([]);
  });
});

describe("verifierMismatches", () => {
  const claude = { storeName: "Costco Wholesale", purchasedAt: "2026-10-06", totalCents: 11411 };

  test("ignores an implausible verifier year, as Gemini read 2020 on both test receipts", () => {
    expect(verifierMismatches(claude, { ...claude, purchasedAt: "2020-10-06" }, uploaded, PDT)).toEqual([]);
  });

  test("still flags a plausible date that disagrees", () => {
    expect(verifierMismatches(claude, { ...claude, purchasedAt: "2026-10-08" }, uploaded, PDT)).toEqual(["date_mismatch"]);
  });

  test("still flags when only the verifier found a plausible date", () => {
    const noDate = { ...claude, purchasedAt: null };
    expect(verifierMismatches(noDate, claude, uploaded, PDT)).toEqual(["date_mismatch"]);
  });

  test("ignoring the date leaves the other fields checked", () => {
    expect(verifierMismatches(claude, { ...claude, purchasedAt: "2020-10-06", totalCents: 999 }, uploaded, PDT)).toEqual([
      "total_mismatch",
    ]);
  });
});
