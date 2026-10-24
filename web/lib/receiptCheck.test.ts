import { describe, expect, test } from "vitest";
import { headerMismatches, purchaseDate } from "./receiptCheck";

const uploaded = Date.UTC(2026, 9, 24, 12);

describe("purchaseDate", () => {
  test("uses a printed date from the last few weeks", () => {
    const printed = Date.UTC(2026, 9, 15);
    expect(purchaseDate("2026-10-15", uploaded)).toEqual({ purchasedAt: printed, printedAt: printed, implausible: false });
  });

  test("falls back to the upload time with no printed date", () => {
    expect(purchaseDate(null, uploaded)).toEqual({ purchasedAt: uploaded, printedAt: null, implausible: false });
    expect(purchaseDate("not a date", uploaded).implausible).toBe(false);
  });

  test("flags a misread year in the past", () => {
    expect(purchaseDate("2023-10-15", uploaded)).toEqual({ purchasedAt: uploaded, printedAt: null, implausible: true });
  });

  test("flags a date in the future", () => {
    expect(purchaseDate("2027-10-15", uploaded).implausible).toBe(true);
  });

  test("allows today's date printed in a timezone ahead of UTC", () => {
    expect(purchaseDate("2026-10-25", uploaded).implausible).toBe(false);
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
