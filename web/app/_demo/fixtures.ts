// TODO(release): delete this file once food groups (no backend yet) read from Convex.

// No backend tracks food groups yet; derive them from items.
export const demoFullness = {
  stocked: ["vegetables", "fruit", "protein", "dairy", "grains"],
  empty: ["frozen foods"],
} as const;
