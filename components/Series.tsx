"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import T from "@/components/T";
import { useLang } from "@/components/useLang";
import { ui } from "@/lib/ui-strings";
/* Type-only: lib/series.ts reaches the filesystem, and a type import is
   erased before the client bundle is built. Everything this needs at runtime
   arrives already computed on the `series` prop. */
import type { Series } from "@/lib/series";

/**
 * "Part 2 of 5" in the header meta row, opening the list of parts.
 *
 * It was a panel under the article first, and it was too much furniture for
 * what it says: five links the reader mostly doesn't need, permanently
 * occupying the end of every part. As a popover the information is one tap
 * away and costs no column.
 *
 * Built like the mobile contents sheet (components/Toc.tsx): same translucent
 * blurred material, always mounted and shown by `data-open` so it animates
 * shut as well as open, `inert` when closed to keep it out of the tab order,
 * an invisible backdrop to catch a tap outside, and contents that wait for
 * the first open. It's anchored to the badge rather than fixed to a corner —
 * the badge is what you pressed, and the panel should grow out of it.
 */
export default function Series({ series }: { series: Series }) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  /** See the note in Toc.tsx: the list waits for the first open, then stays. */
  const [everOpen, setEverOpen] = useState(false);

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
        id="series-parts"
        className="series-sheet"
        data-open={open}
        inert={!open}
        aria-label={lang === "uk" ? "Частини циклу" : "Parts of this series"}
      >
        {everOpen && (
          <>
            <p className="series-head">
              <span className="series-eyebrow">
                <T {...ui.series} />
              </span>
              <span className="series-name">
                <T en={series.name} uk={series.nameUk} />
              </span>
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
                    {part.date && (
                      <time className="series-date" dateTime={part.date}>
                        <T en={part.dateLabel} uk={part.dateLabelUk} />
                      </time>
                    )}
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
