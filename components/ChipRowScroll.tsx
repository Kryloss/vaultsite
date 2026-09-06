"use client";

import { useEffect, useLayoutEffect } from "react";

/* Isomorphic guard — the same shape components/NoteThumbFit.tsx uses. */
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Scrolls the lit filter chip into the two rows the row shows (DECISIONS
 * #141, #143).
 *
 * The cap is what makes this necessary: with nineteen studios the active chip
 * can sit ten columns along, and you pressed that chip to get here — arriving
 * at a row scrolled past it is the one thing a capped row can get wrong.
 *
 * `scrollLeft`, never `scrollIntoView`. That method walks EVERY scrollable
 * ancestor up to the document, so it also scrolls the page — the article
 * would jump under the reader before they had read the heading. This is #80's
 * lesson, where the same call was scrolling the whole page sideways to reach
 * a drawer parked off-window.
 *
 * Before paint, so the row is never seen at the start and then corrected.
 * No-JS gets column one, which still scrolls — the chips are ordinary links
 * and nothing here is load-bearing.
 */
export default function ChipRowScroll() {
  useIsoLayoutEffect(() => {
    const row = document.querySelector<HTMLElement>(".filter-chips");
    const active = row?.querySelector<HTMLElement>("[data-active]");
    if (!row || !active) return;
    // Nothing to do when the row hasn't overflowed — a shelf with four
    // categories never scrolls, and writing scrollLeft there is a no-op that
    // still costs a layout read.
    if (row.scrollWidth <= row.clientWidth) return;

    /* Centred rather than flush left: at the left edge the chip reads as the
       FIRST one, which is what Top is, and the chips either side of it are
       what say the row goes further both ways. */
    const offset =
      active.offsetLeft - (row.clientWidth - active.offsetWidth) / 2;
    row.scrollLeft = Math.max(0, offset);
  }, []);

  return null;
}
