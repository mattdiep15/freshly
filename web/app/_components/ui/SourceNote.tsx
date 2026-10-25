import type { TipSource } from "@/lib/types";

// "web" is a range or tip written from a sentence quoted from an allowlisted page, usually StillTasty.
const labels: Record<TipSource | "web", string> = {
  fda_chart: "fda storage chart",
  foodkeeper: "usda foodkeeper",
  llm: "ai estimate",
  web: "food safety page",
};

export function SourceNote({ source }: { source: TipSource | "web" }) {
  return <small className="source-note">source: {labels[source]}</small>;
}
