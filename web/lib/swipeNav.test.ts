import { describe, expect, it } from "vitest";
import { swipeTarget } from "./swipeNav";

describe("swipeTarget", () => {
  it("moves one tab in the swipe's direction", () => {
    expect(swipeTarget("/recipes", -120, 10, 300)).toBe("/grocery");
    expect(swipeTarget("/recipes", 120, 10, 300)).toBe("/fridge");
  });

  it("stops at the ends instead of wrapping", () => {
    expect(swipeTarget("/fridge", 120, 0, 300)).toBeNull();
    expect(swipeTarget("/community", -120, 0, 300)).toBeNull();
  });

  it("ignores short, slanted, and slow swipes", () => {
    expect(swipeTarget("/grocery", -60, 0, 300)).toBeNull();
    expect(swipeTarget("/grocery", -120, 80, 300)).toBeNull();
    expect(swipeTarget("/grocery", -120, 0, 900)).toBeNull();
  });

  it("ignores pages outside the bottom nav", () => {
    expect(swipeTarget("/scan", -120, 0, 300)).toBeNull();
  });
});
