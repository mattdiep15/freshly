// Sourced text shapes for the UI. Mirrors `storageTip` and `freshnessHint` on the `foods` table.
export type TipSource = "fda_chart" | "foodkeeper" | "llm";

export type SourcedText = {
  text: string;
  source: TipSource;
};
