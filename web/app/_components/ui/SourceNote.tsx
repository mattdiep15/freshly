import type { TipSource } from "@/lib/types";

// "web" is a shelf-life range quoted from an allowlisted page; tips never use it.
const labels: Record<TipSource | "web", string> = {
  fda_chart: "fda storage chart",
  foodkeeper: "usda foodkeeper",
  llm: "ai estimate",
  web: "food safety page",
};

export function SourceNote({ source }: { source: TipSource | "web" }) {
  return <small className="source-note">source: {labels[source]}</small>;
}
