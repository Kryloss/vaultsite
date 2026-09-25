/**
 * Bookmarks — page idea `bookmarks` (lib/site-config.ts, DECISIONS #180), the
 * site-wide one: Obsidian's Bookmarks pane, for a reader. Any page can be
 * kept from the breadcrumb chip (or `b`); the kept pages list at the top of
 * the empty ⌘K and in the drawer.
 *
 * Paths only, like lib/recents.ts — titles come from the search index when
 * shown, so a renamed note keeps its bookmark and a deleted one quietly drops
 * out of every list. Stored in this browser only; nothing leaves it.
 *
 * `toggled()` is the pure part and is tested; the rest is storage and a
 * change event so every open control (chip, drawer, palette) agrees at once.
 */

const KEY = "vaultsite:bookmarks";
const EVENT = "vaultsite:bookmarks";
const LIMIT = 50;

export function normalise(path: string): string {
  return path.replace(/[?#].*$/, "").replace(/\/$/, "") || "/";
}

/** The list with `path` added at the front, or removed if it was there. */
export function toggled(list: string[], path: string): string[] {
  const p = normalise(path);
  return list.includes(p) ? list.filter((x) => x !== p) : [p, ...list].slice(0, LIMIT);
}

export function readBookmarks(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function toggleBookmark(path: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(toggled(readBookmarks(), path)));
  } catch {
    /* storage unavailable — the chip simply doesn't stick */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** For useSyncExternalStore: this tab's changes and other tabs' alike. */
export function subscribeBookmarks(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** A string snapshot, so React compares it by value. */
export function bookmarksSnapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function parseSnapshot(snapshot: string): string[] {
  try {
    const parsed: unknown = JSON.parse(snapshot);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}
