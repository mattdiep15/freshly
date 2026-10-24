// TODO(release): delete this file once fridge fullness (no backend yet) and the friends leaderboard (P2) read from Convex.

// No backend tracks fridge fullness or food groups yet; derive both from items.
export const demoFullness = {
  stage: 70,
  stocked: ["vegetables", "fruit", "protein", "dairy", "grains"],
  empty: ["frozen foods"],
} as const;

export const demoLeaderboard = [
  { name: "maya", lbsWasted: 0.2, streakDays: 18, isYou: false },
  { name: "you", lbsWasted: 0.4, streakDays: 12, isYou: true },
  { name: "theo", lbsWasted: 0.7, streakDays: 9, isYou: false },
  { name: "dev", lbsWasted: 1.1, streakDays: 6, isYou: false },
  { name: "nina", lbsWasted: 1.4, streakDays: 4, isYou: false },
];
