import type { WebPage } from "../../lib/webShelfLife";

// 2 GB per run: the account caps all runs at 16 GB, and the plain HTTP fetcher needs little.
const APIFY_ACTOR = "https://api.apify.com/v2/acts/apify~rag-web-browser/run-sync-get-dataset-items?memory=2048";
// Long pages are mostly navigation and ads; the useful text comes early.
const MAX_PAGE_CHARS = 20000;

// Top web results as markdown; `keep` drops pages from sites the caller does not trust.
export async function searchPages(query: string, token: string, keep: (url: string) => boolean = () => true): Promise<WebPage[]> {
  const res = await fetch(APIFY_ACTOR, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, maxResults: 5, outputFormats: ["markdown"], scrapingTool: "raw-http" }),
  });
  if (!res.ok) throw new Error(`Apify error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const rows = (await res.json()) as { metadata?: { url?: string }; searchResult?: { url?: string }; markdown?: string }[];
  return rows.flatMap((r) => {
    const url = r.metadata?.url ?? r.searchResult?.url;
    return url && r.markdown && keep(url) ? [{ url, markdown: r.markdown.slice(0, MAX_PAGE_CHARS) }] : [];
  });
}
