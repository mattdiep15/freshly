"use client";

import { useSyncExternalStore } from "react";

export type CommunityView = "numbers" | "friends";

const KEY = "freshly-community-view";
const listeners = new Set<() => void>();

// Per tab, so the switch survives navigation and reloads but starts fresh in a new session.
function read(): CommunityView {
  try {
    return sessionStorage.getItem(KEY) === "friends" ? "friends" : "numbers";
  } catch {
    return "numbers";
  }
}

export function setCommunityView(view: CommunityView) {
  try {
    sessionStorage.setItem(KEY, view);
  } catch {
    // Storage can be blocked; the switch then resets on reload.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useCommunityView(): CommunityView {
  return useSyncExternalStore(subscribe, read, () => "numbers");
}
