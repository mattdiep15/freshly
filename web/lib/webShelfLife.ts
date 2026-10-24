import type { Location, ShelfLife } from "./referenceMerge";

// Shelf-life reference sites; pages from anywhere else are dropped before the model reads them.
// Not all of .edu: search results there include SEO spam hosted on university subdomains.
const ALLOWED_HOSTS = ["stilltasty.com", "usda.gov", "fda.gov", "foodsafety.gov"];

export type WebPage = { url: string; markdown: string };

export type WebEntry = {
  location: Location;
  basis: "unopened" | "after_opening" | "past_printed_date" | "from_purchase";
  minDays: number;
  maxDays: number;
  url: string;
  quote: string;
};

type FoodForLookup = {
  hasPrintedDate?: boolean;
  webLookupAt?: number;
  fridgeDays?: ShelfLife;
  freezerDays?: ShelfLife;
  pantryDays?: ShelfLife;
};

// Packaged foods with no FDA or FoodKeeper range, searched once.
export function needsWebLookup(food: FoodForLookup | null): boolean {
  if (!food || food.hasPrintedDate !== true || food.webLookupAt !== undefined) return false;
  return !food.fridgeDays && !food.freezerDays && !food.pantryDays;
}

export function allowedSite(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

// Markdown images, links, emphasis, curly quotes, and line breaks differ between the page and the model's copy.
const normalize = (s: string) =>
  s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[*_#>\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// The model must copy the passage its numbers came from; anything not on the page is rejected.
export function quoteOnPage(markdown: string, quote: string): boolean {
  const q = normalize(quote);
  return q.length >= 20 && normalize(markdown).includes(q);
}

const KEY: Record<Location, "fridgeDays" | "freezerDays" | "pantryDays"> = {
  fridge: "fridgeDays",
  freezer: "freezerDays",
  pantry: "pantryDays",
};

// Items are dated from purchase while still sealed, so an after-opening figure is used only when a page gives nothing else.
const rank = (e: WebEntry) => (e.basis === "after_opening" ? 1 : 0);

// Keeps entries backed by an allowlisted page and a real quote, then per location the shortest range of the best basis.
export function pickWebRanges(
  entries: WebEntry[],
  pages: WebPage[],
): Partial<Record<"fridgeDays" | "freezerDays" | "pantryDays", ShelfLife>> {
  const best: Partial<Record<Location, WebEntry>> = {};
  for (const e of entries) {
    const page = pages.find((p) => p.url === e.url);
    if (!page || !allowedSite(page.url) || !quoteOnPage(page.markdown, e.quote)) continue;
    if (!(e.minDays > 0 && e.minDays <= e.maxDays && e.maxDays <= 3650)) continue;
    const current = best[e.location];
    if (!current || rank(e) < rank(current) || (rank(e) === rank(current) && e.minDays < current.minDays)) {
      best[e.location] = e;
    }
  }
  const ranges: Partial<Record<"fridgeDays" | "freezerDays" | "pantryDays", ShelfLife>> = {};
  for (const [loc, e] of Object.entries(best) as [Location, WebEntry][]) {
    ranges[KEY[loc]] = { min: e.minDays, max: e.maxDays, source: "web", ref: `${e.url} > ${e.basis} > "${e.quote}"` };
  }
  return ranges;
}
