// FoodKeeper names one row for a food and its variants, e.g. "cream pies, banana cream, butterscotch".
export function splitFoodName(name: string): { base: string; detail: string } {
  const comma = name.indexOf(",");
  if (comma === -1) return { base: name.trim(), detail: "" };
  return { base: name.slice(0, comma).trim(), detail: name.slice(comma + 1).trim() };
}
