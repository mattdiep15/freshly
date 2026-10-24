"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "@/app/_components/theme";

const THEME_EVENT = "freshly-theme-change";

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

function currentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
  // Null on the server, so the label renders only once the real theme is known.
  const theme = useSyncExternalStore(subscribe, currentTheme, () => null);
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`Switch to ${next} mode`}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
          // Private mode can block storage; the theme still applies for this visit.
        }
        window.dispatchEvent(new Event(THEME_EVENT));
      }}
    >
      {theme && next}
    </button>
  );
}
