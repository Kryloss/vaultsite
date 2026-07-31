"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import T from "@/components/T";
import { useLang } from "@/components/useLang";
/* Type-only: lib/series.ts reaches the filesystem, and a type import is
   erased before the client bundle is built. Everything this needs at runtime
   arrives already computed on the `series` prop. */
import type { Series } from "@/lib/series";

/** Breathing room between the popover and the window's edge. */
const EDGE = 12;

/**
 * "Part 2 of 5" in the header meta row, opening the list of parts.
 *
 * It was a panel under the article first, and it was too much furniture for
 * what it says: a handful of links the reader mostly doesn't need,
 * permanently occupying the end of every part. As a popover the information
 * is one tap away and costs no column.
 *
 * Built like the mobile contents sheet (components/Toc.tsx): same translucent
 * blurred material, always mounted and shown by `data-open` so it animates
 * shut as well as open, `inert` when closed to keep it out of the tab order,
 * an invisible backdrop to catch a tap outside, and contents that wait for
 * the first open. Anchored to the badge at every width — it should look like
 * the thing you pressed opening, and a panel that appeared at the bottom of
 * the window on a phone looked like something else arriving.
 *
 * Rows are a number and a title. No dates: this is a place to go, not a thing
 * to read, and the numbering already carries the order.
 */
export default function Series({ series }: { series: Series }) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  /** See the note in Toc.tsx: the list waits for the first open, then stays. */
  const [everOpen, setEverOpen] = useState(false);
  const sheetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (open) setEverOpen(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /**
   * Pull the popover back inside the window if it would hang off the right.
   *
   * The badge sits in a metadata row that wraps, so on a narrow screen it can
   * end up anywhere across the column — a panel hung off its left edge is one
   * long title away from running off-screen. Nine lines of measurement beat
   * the alternative, which was relocating the whole thing to the bottom of
   * the window on phones and losing its connection to the badge.
   *
   * Measured with `offsetWidth`, not `getBoundingClientRect().width`: this
   * runs while the open transition is still scaling the element, and a
   * transformed rect would report a width 3% short.
   */
  useEffect(() => {
    const el = sheetRef.current;
    if (!open || !el) return;

    const place = () => {
      const anchor = el.parentElement?.getBoundingClientRect();
      if (!anchor) return;
      const overflow = anchor.left + el.offsetWidth - (window.innerWidth - EDGE);
      el.style.left = overflow > 0 ? `${-overflow}px` : "0px";
    };

    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, lang]);

  return (
    <span className="series-anchor">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="series-parts"
        className="series-badge"
      >
        <T {...series.partLabel} />
      </button>

      <span
        className="series-backdrop"
        data-open={open}
        aria-hidden
        onClick={() => setOpen(false)}
      />

      <nav
        ref={sheetRef}
        id="series-parts"
        className="series-sheet"
        data-open={open}
        inert={!open}
        aria-label={lang === "uk" ? "Частини циклу" : "Parts of this series"}
      >
        {everOpen && (
          <>
            {/* The series' own name, and no label in front of it — "Series:
                Road to Security+" says the word twice over, once needlessly. */}
            <p className="series-name">
              <T en={series.name} uk={series.nameUk} />
            </p>

            <ol className="series-list">
              {series.parts.map((part) => {
                const label = (
                  <>
                    <span className="series-number" aria-hidden>
                      {part.number}
                    </span>
                    <span className="series-part-title">
                      <T en={part.title} uk={part.titleUk} />
                    </span>
                  </>
                );

                return (
                  <li key={part.href}>
                    {part.current ? (
                      /* The note you're on stays in the list, unlinked — take
                         it out and the numbers lie about where you are. */
                      <span
                        className="series-link series-current"
                        aria-current="true"
                      >
                        {label}
                      </span>
                    ) : (
                      <Link
                        href={part.href}
                        className="series-link"
                        onClick={() => setOpen(false)}
                      >
                        {label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </nav>
    </span>
  );
}
