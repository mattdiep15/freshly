// View shapes for the UI. Mirrors the planned `items` and `foods` tables in p1-01.
export type TipSource = "fda_chart" | "foodkeeper" | "llm";

export type SourcedText = {
  text: string;
  source: TipSource;
};

export type FridgeItem = {
  id: string;
  name: string;
  // Absent when no sourced shelf life exists and the user has not set one.
  expiresAt?: number;
  expirySource?: "fda_chart" | "foodkeeper" | "user";
  storageTip?: SourcedText;
  freshnessHint?: SourcedText;
};
