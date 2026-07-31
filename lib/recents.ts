"use client";

/**
 * The pages you've been on lately, for the empty ⌘K.
 *
 * An empty palette used to show the first eight pages of the index, which is
 * the same eight every time and says nothing about you. Recents make the
 * common case — going back to the note you were just reading — the first
 * thing under the cursor.
 *
 * Only paths are stored. Titles come from the search index at display time,
 * so a renamed note shows its new name and nothing here can go stale except
 * by pointing at a page that no longer exists — which the lookup simply
 * doesn't find.
 *
 * Same storage discipline as components/ReadingPosition.tsx: one key holding
 * a bounded list, not a key per page.
 */

const KEY = "vaultsite:recent";

/** Enough to cover a session's back-and-forth without becoming a history. */
const LIMIT = 12;

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    // Private mode, a full quota, or something else wrote nonsense here.
    return [];
  }
}

/** Most recent first, with `path` moved to the front rather than duplicated. */
export function remember(path: string): void {
  if (typeof window === "undefined") return;
  const normalised = path.replace(/\/$/, "") || "/";
  try {
    const next = [normalised, ...read().filter((p) => p !== normalised)].slice(0, LIMIT);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — recents are a nicety, never a requirement */
  }
}

/**
 * @param exclude the page being viewed. Offering to navigate to where you
 * already are wastes the first row, which is the one that matters most.
 */
export function recentPaths(exclude?: string): string[] {
  if (typeof window === "undefined") return [];
  const here = exclude?.replace(/\/$/, "") || "/";
  return read().filter((p) => p !== here);
}
