// Bottom-nav order on phones; a swipe moves one tab and never wraps.
export const SWIPE_TABS = ["/fridge", "/recipes", "/grocery", "/community"] as const;

const MIN_DISTANCE = 80;
// Horizontal travel must beat vertical by this much, so a slanted scroll never changes tabs.
const MIN_RATIO = 2;
const MAX_DURATION_MS = 600;

// The tab a finished swipe goes to, or null when it was a scroll, too short, too slow, or off the ends.
export function swipeTarget(path: string, dx: number, dy: number, durationMs: number): string | null {
  const index = SWIPE_TABS.indexOf(path as (typeof SWIPE_TABS)[number]);
  if (index === -1) return null;
  if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < MIN_RATIO * Math.abs(dy) || durationMs > MAX_DURATION_MS) return null;
  // Swiping left brings in the tab to the right, as on a phone's home screen.
  return SWIPE_TABS[index + (dx < 0 ? 1 : -1)] ?? null;
}
