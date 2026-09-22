"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ColourTheme = "vaultsite" | "notion";

const STORAGE_KEY = "colour-theme";
const CHANGE_EVENT = "colourthemechange";

function currentTheme(): ColourTheme {
  return document.documentElement.dataset.colourTheme === "notion"
    ? "notion"
    : "vaultsite";
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

/**
 * The colour family is independent of light/dark appearance: the latter still
 * follows `prefers-color-scheme`. The selected family lives on <html> so every
 * CSS token changes together, and app/layout.tsx restores it before paint.
 */
export function useColourTheme() {
  const theme = useSyncExternalStore(
    subscribe,
    currentTheme,
    () => "vaultsite"
  );

  const setTheme = useCallback((next: ColourTheme) => {
    if (next === "notion") {
      document.documentElement.dataset.colourTheme = "notion";
    } else {
      delete document.documentElement.dataset.colourTheme;
    }
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* The selection still applies for this visit when storage is blocked. */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const toggle = useCallback(
    () => setTheme(theme === "notion" ? "vaultsite" : "notion"),
    [setTheme, theme]
  );

  return { theme, setTheme, toggle };
}
