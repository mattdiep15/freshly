"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Holds one decision for `delayMs` so an undo toast can take it back before it is saved.
export function useDelayedCommit<T>(commit: (value: T) => void, delayMs: number) {
  const [pending, setPending] = useState<T | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const pendingRef = useRef<T | null>(null);
  const commitRef = useRef(commit);

  useEffect(() => {
    commitRef.current = commit;
  });

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    if (pendingRef.current !== null) commitRef.current(pendingRef.current);
    pendingRef.current = null;
    setPending(null);
  }, []);

  const queue = useCallback(
    (value: T) => {
      // A second decision saves the first instead of dropping it.
      flush();
      pendingRef.current = value;
      setPending(value);
      timer.current = window.setTimeout(flush, delayMs);
    },
    [delayMs, flush],
  );

  const undo = useCallback(() => {
    window.clearTimeout(timer.current);
    const value = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    return value;
  }, []);

  // Leaving the page saves the decision rather than losing it.
  useEffect(() => flush, [flush]);

  return { pending, queue, undo };
}
