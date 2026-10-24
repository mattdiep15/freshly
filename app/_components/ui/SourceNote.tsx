import type { TipSource } from "@/lib/types";

const labels: Record<TipSource, string> = {
  fda_chart: "fda storage chart",
  foodkeeper: "usda foodkeeper",
  llm: "ai estimate",
};

export function SourceNote({ source }: { source: TipSource }) {
  return <small className="source-note">source: {labels[source]}</small>;
}
