"use client";

import { useSyncExternalStore } from "react";

const MINUTE_MS = 60_000;

function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, MINUTE_MS);
  return () => window.clearInterval(id);
}

// Rounded to the minute so the snapshot stays stable between renders.
const getSnapshot = () => Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;

// Null on the server so prerendered HTML never bakes in a stale date.
const getServerSnapshot = () => null;

export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
