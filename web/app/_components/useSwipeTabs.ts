"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { SWIPE_TABS, swipeTarget } from "@/lib/swipeNav";

// Anything that already handles a tap or a sideways drag keeps the gesture.
const OWNS_GESTURE =
  'a, button, input, select, textarea, label, summary, [role="button"], [role="tab"], [role="dialog"], [contenteditable], .grocery-swipe, .food-card, header';
// iOS uses edge swipes for back and forward.
const EDGE_PX = 24;
// Share of the finger's travel the page follows; much less at the first and last tab, where there is nowhere to go.
const FOLLOW = 0.5;
const END_RESIST = 0.15;
const OUT_MS = 140;
const IN_MS = 240;
const BACK_MS = 180;
// Gives up on the slide-in if the route never changes, so the page is never left pushed aside.
const NAV_TIMEOUT_MS = 1500;

function scrollsSideways(target: Element): boolean {
  for (let el: Element | null = target; el; el = el.parentElement) {
    const overflow = getComputedStyle(el).overflowX;
    if ((overflow === "auto" || overflow === "scroll") && el.scrollWidth > el.clientWidth + 1) return true;
  }
  return false;
}

const hasNeighbor = (path: string, dx: number) => {
  const index = SWIPE_TABS.indexOf(path as (typeof SWIPE_TABS)[number]);
  return index !== -1 && SWIPE_TABS[index + (dx < 0 ? 1 : -1)] !== undefined;
};

// Phones only: a horizontal swipe on blank space drags the page and moves to the neighboring bottom-nav tab.
export function useSwipeTabs(pathname: string) {
  const router = useRouter();
  // Set while a committed swipe waits for the new route: which way the old page left, and its exit animation.
  const leaving = useRef<{ direction: number; exit: Animation; timeout: number } | null>(null);

  // The new tab slides in from the side the finger moved away from.
  useEffect(() => {
    const pending = leaving.current;
    const page = document.querySelector<HTMLElement>(".mobile-page-scroll");
    if (!pending || !page) return;
    leaving.current = null;
    window.clearTimeout(pending.timeout);
    pending.exit.cancel();
    const from = -pending.direction * page.offsetWidth * 0.4;
    page.animate([{ transform: `translateX(${from}px)`, opacity: 0 }, { transform: "none", opacity: 1 }], {
      duration: IN_MS,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    });
  }, [pathname]);

  useEffect(() => {
    let start: { x: number; y: number; t: number } | null = null;
    // Null until the gesture picks an axis; a vertical start hands it to scrolling.
    let horizontal: boolean | null = null;
    const page = () => document.querySelector<HTMLElement>(".mobile-page-scroll");
    const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const reset = (el: HTMLElement) => {
      el.style.transform = "";
      el.style.opacity = "";
    };

    const onStart = (event: TouchEvent) => {
      start = null;
      horizontal = null;
      const touch = event.touches[0];
      const target = event.target;
      if (event.touches.length > 1 || !(target instanceof Element) || window.innerWidth >= 768 || leaving.current) return;
      if (touch.clientX < EDGE_PX || touch.clientX > window.innerWidth - EDGE_PX) return;
      if (target.closest(OWNS_GESTURE) || scrollsSideways(target)) return;
      start = { x: touch.clientX, y: touch.clientY, t: event.timeStamp };
    };

    const onMove = (event: TouchEvent) => {
      const el = page();
      if (!start || !el) return;
      const touch = event.touches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (horizontal === null) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > 2 * Math.abs(dy)) horizontal = true;
        else if (Math.abs(dy) > 10) start = null;
        return;
      }
      if (reduced()) return;
      const offset = dx * (hasNeighbor(pathname, dx) ? FOLLOW : END_RESIST);
      el.style.transform = `translateX(${offset}px)`;
      el.style.opacity = String(1 - Math.min(Math.abs(offset) / el.offsetWidth, 0.5));
    };

    const onEnd = (event: TouchEvent) => {
      const el = page();
      if (!start || !el) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const next = horizontal ? swipeTarget(pathname, dx, touch.clientY - start.y, event.timeStamp - start.t) : null;
      start = null;
      const dragged = el.style.transform;
      reset(el);
      if (!next) {
        if (dragged) el.animate([{ transform: dragged }, { transform: "none" }], { duration: BACK_MS, easing: "ease-out" });
        return;
      }
      if (reduced()) return router.push(next);
      const direction = dx < 0 ? -1 : 1;
      const exit = el.animate(
        [{ transform: dragged || "none" }, { transform: `translateX(${direction * el.offsetWidth * 0.4}px)`, opacity: 0 }],
        { duration: OUT_MS, easing: "ease-in", fill: "forwards" },
      );
      const timeout = window.setTimeout(() => {
        exit.cancel();
        leaving.current = null;
      }, NAV_TIMEOUT_MS);
      leaving.current = { direction, exit, timeout };
      // A timer rather than onfinish, which never fires while the page is not rendering frames.
      window.setTimeout(() => router.push(next), OUT_MS);
    };

    const onCancel = () => {
      start = null;
      const el = page();
      if (el) reset(el);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onCancel);
    };
  }, [pathname, router]);
}
