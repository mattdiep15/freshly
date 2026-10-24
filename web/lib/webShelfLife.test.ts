import { describe, expect, test } from "vitest";
import { allowedSite, needsWebLookup, pickWebRanges, quoteOnPage, type WebEntry } from "./webShelfLife";

const fda = { min: 1, max: 2, source: "fda_chart" as const, ref: "FDA chart" };
const page = {
  url: "https://www.stilltasty.com/fooditems/index/18432",
  markdown:
    "## Energy drinks\n\nAn **unopened** can of energy drink will generally stay at best quality for about 6 to 9 months.\nOnce opened, energy drinks will keep for about 3 to 4 days in the fridge.",
};
const unopened: WebEntry = {
  location: "pantry",
  basis: "past_printed_date",
  minDays: 180,
  maxDays: 270,
  url: page.url,
  quote: "An unopened can of energy drink will generally stay at best quality for about 6 to 9 months.",
};
const opened: WebEntry = {
  location: "pantry",
  basis: "after_opening",
  minDays: 3,
  maxDays: 4,
  url: page.url,
  quote: "Once opened, energy drinks will keep for about 3 to 4 days in the fridge.",
};

describe("needsWebLookup", () => {
  test("looks up a packaged food with no sourced range, once", () => {
    expect(needsWebLookup({ hasPrintedDate: true })).toBe(true);
    expect(needsWebLookup({ hasPrintedDate: true, webLookupAt: 1 })).toBe(false);
  });

  test("skips fresh foods and foods with any FDA or FoodKeeper range", () => {
    expect(needsWebLookup({ hasPrintedDate: false })).toBe(false);
    expect(needsWebLookup({})).toBe(false);
    expect(needsWebLookup({ hasPrintedDate: true, freezerDays: fda })).toBe(false);
    expect(needsWebLookup(null)).toBe(false);
  });
});

describe("allowedSite", () => {
  test("accepts the shelf-life sites and their subdomains", () => {
    expect(allowedSite("https://www.stilltasty.com/x")).toBe(true);
    expect(allowedSite("https://www.fsis.usda.gov/x")).toBe(true);
  });

  test("rejects lookalikes and junk", () => {
    expect(allowedSite("https://notstilltasty.com/x")).toBe(false);
    expect(allowedSite("https://usda.gov.example.com/x")).toBe(false);
    expect(allowedSite("https://listings.sandbox.library.columbia.edu/x")).toBe(false);
    expect(allowedSite("not a url")).toBe(false);
  });
});

describe("quoteOnPage", () => {
  test("matches across markdown emphasis, case, and line breaks", () => {
    expect(quoteOnPage(page.markdown, unopened.quote)).toBe(true);
  });

  test("matches a table-style page once image markup is dropped", () => {
    const table =
      "## PUDDING MIX, DRY — UNOPENED\n\nPantry ![](https://www.stilltasty.com/img/pantry.jpg)\n\n![Arrow](https://x/a.gif)\n\n12 months";
    expect(quoteOnPage(table, "PUDDING MIX, DRY - UNOPENED Pantry 12 months")).toBe(true);
  });

  test("rejects a sentence that is not on the page, and fragments too short to mean anything", () => {
    expect(quoteOnPage(page.markdown, "An unopened can of energy drink lasts 2 years.")).toBe(false);
    expect(quoteOnPage(page.markdown, "6 to 9 months")).toBe(false);
  });
});

describe("pickWebRanges", () => {
  test("prefers the sealed figure over the after-opening one and cites the page and quote", () => {
    expect(pickWebRanges([opened, unopened], [page])).toEqual({
      pantryDays: { min: 180, max: 270, source: "web", ref: `${page.url} > past_printed_date > "${unopened.quote}"` },
    });
  });

  test("uses an after-opening figure when it is the only one", () => {
    expect(pickWebRanges([opened], [page]).pantryDays?.min).toBe(3);
  });

  test("keeps the shortest of two sealed figures", () => {
    const shorter = { ...unopened, basis: "unopened" as const, minDays: 90, maxDays: 120 };
    expect(pickWebRanges([unopened, shorter], [page]).pantryDays?.min).toBe(90);
  });

  test("drops entries with an invented quote, an unknown page, a blocked site, or bad numbers", () => {
    const blocked = { url: "https://randomblog.com/energy", markdown: page.markdown };
    expect(
      pickWebRanges(
        [
          { ...unopened, quote: "An unopened can of energy drink lasts for two whole years." },
          { ...unopened, url: "https://www.stilltasty.com/other" },
          { ...unopened, url: blocked.url },
          { ...opened, minDays: 5, maxDays: 4 },
        ],
        [page, blocked],
      ),
    ).toEqual({});
  });
});
