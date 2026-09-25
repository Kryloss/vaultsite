"use client";

import { useSyncExternalStore } from "react";
import T from "@/components/T";
import { freshnessLabel, monthsSince } from "@/lib/freshness";

/** The clock is read once per render; nothing to subscribe to. */
const subscribe = () => () => {};

/**
 * "· 2 months ago" after the Now page's "Updated July 2026" (page idea
 * `nowFreshness`, lib/site-config.ts).
 *
 * Client-only and starts hidden, like NewBadge: the page is built once and
 * read for months, so an age worked out at build time would be wrong by the
 * next morning. The server snapshot is null, so the static HTML and the
 * hydration pass render nothing, and the reader's own clock fills it in
 * straight after. Reads the ENGLISH field — `updated_uk` is the same month in
 * words the parser doesn't need to learn.
 */
export default function NowFreshness({ updated }: { updated: string }) {
  const months = useSyncExternalStore(
    subscribe,
    () => monthsSince(updated, new Date()),
    () => null
  );

  if (months === null) return null;
  return (
    <span className="idea-now-fresh">
      <span aria-hidden>·</span> <T {...freshnessLabel(months)} />
    </span>
  );
}
