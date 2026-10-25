import { describe, expect, test } from "vitest";
import {
  allowedSite,
  needsWebLookup,
  needsWebRanges,
  pickWebRanges,
  pickWebTips,
  quoteOnPage,
  replaceableTip,
  type WebEntry,
} from "./webShelfLife";

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

const sourcedTips = { storageTip: { source: "foodkeeper" }, freshnessHint: { source: "web" } };

describe("needsWebRanges", () => {
  test("takes web ranges only for a packaged food with no FDA or FoodKeeper range", () => {
    expect(needsWebRanges({ hasPrintedDate: true })).toBe(true);
    expect(needsWebRanges({ hasPrintedDate: false })).toBe(false);
    expect(needsWebRanges({})).toBe(false);
    expect(needsWebRanges({ hasPrintedDate: true, freezerDays: fda })).toBe(false);
  });
});

describe("needsWebLookup", () => {
  test("looks up a packaged food with no sourced range, once", () => {
    expect(needsWebLookup({ hasPrintedDate: true, ...sourcedTips })).toBe(true);
    expect(needsWebLookup({ hasPrintedDate: true, webLookupAt: 1 })).toBe(false);
  });

  test("looks up any food whose tip or hint is missing or model-written", () => {
    expect(needsWebLookup({ hasPrintedDate: false, freezerDays: fda })).toBe(true);
    expect(needsWebLookup({ freezerDays: fda, ...sourcedTips, freshnessHint: { source: "llm" } })).toBe(true);
  });

  test("skips a food with a sourced range and sourced tips, and a missing food", () => {
    expect(needsWebLookup({ freezerDays: fda, ...sourcedTips })).toBe(false);
    expect(needsWebLookup(null)).toBe(false);
  });
});

describe("replaceableTip", () => {
  test("replaces only a missing or model-written tip", () => {
    expect(replaceableTip(undefined)).toBe(true);
    expect(replaceableTip({ source: "llm" })).toBe(true);
    expect(replaceableTip({ source: "foodkeeper" })).toBe(false);
    expect(replaceableTip({ source: "web" })).toBe(false);
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

describe("pickWebTips", () => {
  const chicken = {
    url: "https://www.stilltasty.com/fooditems/index/16798",
    markdown:
      "## Shelf Life Tips\n\n* How to tell if raw ground chicken is bad? Signs of bad ground chicken are a sour smell, dull color and slimy texture.\n* Refrigerate raw ground chicken in its original store packaging.",
  };
  const hint = {
    text: "A sour smell, dull color, or slimy texture means it has gone bad.",
    url: chicken.url,
    quote: "Signs of bad ground chicken are a sour smell, dull color and slimy texture.",
  };
  const tip = {
    text: "Keep it in the fridge in its original store packaging.",
    url: chicken.url,
    quote: "Refrigerate raw ground chicken in its original store packaging.",
  };

  test("keeps a tip and hint whose quotes are on the page, citing the page and quote", () => {
    expect(pickWebTips({ storageTip: tip, freshnessHint: hint }, [chicken])).toEqual({
      storageTip: { text: tip.text, source: "web", ref: `${chicken.url} > "${tip.quote}"` },
      freshnessHint: { text: hint.text, source: "web", ref: `${chicken.url} > "${hint.quote}"` },
    });
  });

  test("drops an invented quote, a blocked site, text that states a duration, and null", () => {
    const blocked = { url: "https://randomblog.com/chicken", markdown: chicken.markdown };
    const pick = (storageTip: typeof tip, pages = [chicken]) => pickWebTips({ storageTip, freshnessHint: null }, pages);
    expect(pick({ ...tip, quote: "Store raw ground chicken on the top shelf of the fridge." })).toEqual({});
    expect(pick({ ...tip, url: blocked.url }, [blocked])).toEqual({});
    expect(pick({ ...tip, text: "Keep it in the fridge for up to 2 days." })).toEqual({});
  });
});
