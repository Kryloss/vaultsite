"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The horizontal scroller behind each shelf row, with a soft fade on whichever
 * edge has more content past it.
 *
 * The row hides its scrollbar (see `.shelf-row` in globals.css), which looks
 * clean and takes away the only signal that a row continues off-screen. The
 * fade puts that signal back: material dissolving at the edge reads as "there
 * is more that way" without adding a control to look at.
 *
 * **A client component for four lines of state, deliberately.** The CSS-only
 * version of this is a scroll-driven animation (`animation-timeline: scroll()`)
 * and it would be lovely — no JavaScript, no listener — but it lands only in
 * Chromium today, so on Safari and Firefox the rows would keep exactly the
 * problem this exists to fix. A scroll listener is boring and works everywhere.
 * Revisit when `scroll()` timelines are broadly supported.
 *
 * The mask lives on this wrapper rather than the scroller itself: a mask on the
 * scrolling element travels with its content, so the fade would slide away with
 * the covers instead of staying at the edge.
 */

/** Ignore a pixel or two of sub-pixel rounding at either end. */
const EPSILON = 2;

type Edge = "none" | "start" | "middle" | "end";

export default function ShelfRow({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState<Edge>("none");

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= EPSILON) return setEdge("none"); // everything fits; no fade
    const atStart = el.scrollLeft <= EPSILON;
    const atEnd = el.scrollLeft >= max - EPSILON;
    setEdge(atStart ? "start" : atEnd ? "end" : "middle");
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const onScroll = () => {
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          measure();
        });
      }
    };

    measure();
    el.addEventListener("scroll", onScroll, { passive: true });
    // Covers arriving, the window resizing, or the language toggle changing a
    // caption's width all change whether there's anything left to scroll to.
    const ro = new ResizeObserver(onScroll);
    ro.observe(el);
    window.addEventListener("langchange", measure);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      window.removeEventListener("langchange", measure);
    };
  }, [measure]);

  return (
    <div className="shelf-row-wrap" data-edge={edge}>
      <ul ref={ref} className={className}>
        {children}
      </ul>
    </div>
  );
}
