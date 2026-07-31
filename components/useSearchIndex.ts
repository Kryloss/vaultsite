"use client";

import { useEffect, useState } from "react";
import type { SearchItem } from "@/lib/vault";

/**
 * The search index, fetched once per session from /search-index.json.
 *
 * Module-level cache rather than component state: the palette and the 404
 * page both want the same data, and neither should trigger a second request.
 * See app/search-index.json/route.ts for why it's a file at all.
 */
let cache: SearchItem[] | null = null;
let inflight: Promise<SearchItem[]> | null = null;

function load(): Promise<SearchItem[]> {
  if (cache) return Promise.resolve(cache);
  inflight ??= fetch("/search-index.json")
    .then((r) => (r.ok ? (r.json() as Promise<SearchItem[]>) : []))
    .then((items) => {
      cache = items;
      return items;
    })
    .catch(() => {
      // Offline, or a deploy that moved the file. Drop the failed promise so
      // the next open tries again rather than being stuck with nothing.
      inflight = null;
      return [];
    });
  return inflight;
}

/**
 * Start fetching before it's needed — called when the pointer reaches the
 * search button, so the index is usually there by the time the panel opens.
 * Safe to call repeatedly.
 */
export function warmSearchIndex(): void {
  void load();
}

/**
 * @param enabled fetch only once this is true — the palette passes its
 * "has ever been opened" flag, so a reader who never searches never pays.
 */
export function useSearchIndex(enabled: boolean): SearchItem[] {
  const [items, setItems] = useState<SearchItem[]>(cache ?? []);

  useEffect(() => {
    if (!enabled || cache) return;
    let live = true;
    void load().then((loaded) => {
      if (live) setItems(loaded);
    });
    return () => {
      live = false;
    };
  }, [enabled]);

  // A later mount finds the cache already full and skips the empty first render.
  return cache ?? items;
}
