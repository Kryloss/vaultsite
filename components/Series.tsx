"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import T from "@/components/T";
import { CheckIcon, ListIcon } from "@/components/icons";
import { useLang } from "@/components/useLang";
import { markRead, readNotes, unmarkRead, READ_EVENT } from "@/lib/read-notes";
import { ui } from "@/lib/ui-strings";
/* Type-only: lib/series.ts reaches the filesystem, and a type import is
   erased before the client bundle is built. Everything this needs at runtime
   arrives already computed on the `series` prop. */
import type { Series } from "@/lib/series";

/** Breathing room between the popover and the window's edge. */
const EDGE = 12;

/**
 * "2 of 5" in the header meta row, opening the list of parts.
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
 *
 * **How much of the arc you've read** is layered on top of that, from
 * lib/read-notes.ts — a tick against the parts you finished, a count in the
 * panel, and a line filling under the badge itself so the answer is visible
 * without opening anything. All of it is client-only and starts at zero: the
 * server has no idea who is reading, so the first render must match the one
 * the build produced or React will complain, and the marks appear a frame
 * later. That also means the badge never changes SIZE — an underline that
 * grows can't reflow the metadata row the way "· 3 read" would.
 */
export default function Series({ series }: { series: Series }) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  /** Paths finished, per this browser. Empty until after hydration. */
  const [read, setRead] = useState<ReadonlySet<string>>(() => new Set());
  /** See the note in Toc.tsx: the list waits for the first open, then stays. */
  const [everOpen, setEverOpen] = useState(false);
  const sheetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (open) setEverOpen(true);
  }, [open]);

  /**
   * Read the store once, then again whenever a note is marked read.
   *
   * The event matters for the part you're on: finish it and the badge fills
   * in underneath you, without a navigation and without polling. Everything
   * else about this component already exists on the page by then.
   */
  useEffect(() => {
    const sync = () => setRead(new Set(Object.keys(readNotes())));
    sync();
    window.addEventListener(READ_EVENT, sync);
    return () => window.removeEventListener(READ_EVENT, sync);
  }, []);

  const readCount = series.parts.filter((p) => read.has(p.href)).length;

  /**
   * Tick a part by hand.
   *
   * The automatic signal is a good guess and only a guess — someone who
   * skimmed to the bottom for one line has "finished" by the bar's reckoning
   * and knows they haven't, and a part read on another device was never seen
   * by this browser at all. The store is the reader's, so they get to write to
   * it. No local state: the write fires `noteread`, the listener above re-reads
   * the store, and there is still exactly one source of truth.
   */
  const toggle = (href: string) => {
    if (read.has(href)) unmarkRead(href);
    else markRead(href);
  };

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
        /* The visible "2 of 5" drops the word "Part" (#194); a screen reader
           still hears it, since the icon that stands in for it is silent. */
        aria-label={
          lang === "uk"
            ? `Частина ${series.index} з ${series.total}`
            : `Part ${series.index} of ${series.total}`
        }
        className="series-badge"
      >
        {/* The third page-content icon, at the owner's request (#193): it
            marks the badge as the thing that opens the list of parts, in place
            of the dotted underline. */}
        <ListIcon className="series-badge-icon" />
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
        {/* The scroller is this inner box, not the sheet: the sheet's blur
            layers are absolutely positioned and would scroll away (#190). */}
        <div className="series-sheet-body">
          {everOpen && (
            <>
              {/* The series' own name, and no label in front of it — "Series:
                Road to Security+" says the word twice over, once needlessly. */}
              <p className="series-name">
                <T en={series.name} uk={series.nameUk} />
                {/* Built here rather than in lib/series.ts: this is a client
                  component and that module reaches the filesystem, so the
                  count — which only exists in the browser — can't come from
                  there. Interpolating numbers rules out a `ui` key too. */}
                {readCount > 0 && (
                  /* Just "1 of 2", like the badge — no "read" (#196).
                     The word stays for screen readers. */
                  <span className="series-read-count">
                    <span aria-hidden>
                      {lang === "uk"
                        ? `${readCount} з ${series.total}`
                        : `${readCount} of ${series.total}`}
                    </span>
                    <span className="sr-only">
                      {lang === "uk"
                        ? `${readCount} з ${series.total} прочитано`
                        : `${readCount} of ${series.total} read`}
                    </span>
                  </span>
                )}
              </p>

              <ol className="series-list">
                {series.parts.map((part) => {
                  const done = read.has(part.href);
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
                    <li key={part.href} className="series-row">
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

                      {/* Outside the link, deliberately: a checkbox inside an
                        anchor is a control you can't reach without following
                        the link. Its own button, its own tab stop, and the
                        panel stays open when you press it. */}
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={done}
                        aria-label={
                          done ? ui.markUnread[lang] : ui.markRead[lang]
                        }
                        title={done ? ui.markUnread[lang] : ui.markRead[lang]}
                        className="series-check"
                        onClick={() => toggle(part.href)}
                      >
                        <CheckIcon className="series-tick" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>
      </nav>
    </span>
  );
}
