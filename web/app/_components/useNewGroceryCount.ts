"use client";

import { useSyncExternalStore } from "react";

// Entries added from recipes since the grocery page was last open; in memory, so a reload clears the badge.
let count = 0;
const listeners = new Set<() => void>();

function set(next: number) {
  count = Math.max(0, next);
  listeners.forEach((notify) => notify());
}

export const addNewGroceries = (added: number) => set(count + added);
export const removeNewGroceries = (removed: number) => set(count - removed);
export const clearNewGroceries = () => count !== 0 && set(0);

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useNewGroceryCount(): number {
  return useSyncExternalStore(subscribe, () => count, () => 0);
}
