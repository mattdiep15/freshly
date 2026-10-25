"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { swipeTarget } from "@/lib/swipeNav";

// Anything that already handles a tap or a sideways drag keeps the gesture.
const OWNS_GESTURE =
  'a, button, input, select, textarea, label, summary, [role="button"], [role="tab"], [role="dialog"], [contenteditable], .grocery-swipe, header';
// iOS uses edge swipes for back and forward.
const EDGE_PX = 24;

function scrollsSideways(target: Element): boolean {
  for (let el: Element | null = target; el; el = el.parentElement) {
    const overflow = getComputedStyle(el).overflowX;
    if ((overflow === "auto" || overflow === "scroll") && el.scrollWidth > el.clientWidth + 1) return true;
  }
  return false;
}

// Phones only: a horizontal swipe on blank space moves to the neighboring bottom-nav tab.
export function useSwipeTabs(pathname: string) {
  const router = useRouter();

  useEffect(() => {
    let start: { x: number; y: number; t: number } | null = null;

    const onStart = (event: TouchEvent) => {
      start = null;
      const touch = event.touches[0];
      const target = event.target;
      if (event.touches.length > 1 || !(target instanceof Element) || window.innerWidth >= 768) return;
      if (touch.clientX < EDGE_PX || touch.clientX > window.innerWidth - EDGE_PX) return;
      if (target.closest(OWNS_GESTURE) || scrollsSideways(target)) return;
      start = { x: touch.clientX, y: touch.clientY, t: event.timeStamp };
    };

    const onEnd = (event: TouchEvent) => {
      if (!start) return;
      const touch = event.changedTouches[0];
      const next = swipeTarget(pathname, touch.clientX - start.x, touch.clientY - start.y, event.timeStamp - start.t);
      start = null;
      if (next) router.push(next);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [pathname, router]);
}
