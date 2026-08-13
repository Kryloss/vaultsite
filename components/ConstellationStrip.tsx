"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import T from "@/components/T";
import { useLang } from "@/components/useLang";
import { noteCount } from "@/lib/plural";

/**
 * A week's column, already formatted. Everything the strip needs at runtime
 * arrives on this prop — the dates are rendered server-side, so this file
 * never imports `lib/vault.ts` and its `fs` calls stay out of the bundle.
 * Same split as PostList → PostListClient.
 */
/**
 * The strip's geometry, in px, and the same numbers `globals.css` draws with:
 * a 6px bar and a 1px gap across 25 columns is 174px, which is what fits the
 * drawer's 176px of inner width. They're here as well because the label has to
 * be told which column it sits under, and that can only be arithmetic on the
 * index. Change them in one place and the other is wrong — both say so.
 */
const BAR = 6;
const GAP = 1;
const STRIP_W = 25 * (BAR + GAP) - GAP;
/** Roughly how wide "20.07 · 14n" runs. Only used to decide which way a label
 *  hangs, so a generous guess is the safe one. */
const LABEL_W = 62;

export interface StripWeek {
  /** Monday, `YYYY-MM-DD`. The React key and the open-state token. */
  start: string;
  /** Bar height, 0–1, against the busiest week. */
  fill: number;
  /** "16.07" — the hover label, where there's no room for a month's name. */
  short: string;
  dateEn: string;
  dateUk: string;
  notes: { href: string; title: string; titleUk?: string }[];
}

/**
 * The interactive half of the sidebar note strip.
 *
 * Two things are deliberate about the interaction, and both came from using
 * the first version:
 *
 * THE COUNT IS HIDDEN UNTIL YOU LOOK. "27 notes · 6 months" sitting there
 * permanently is a statistic the drawer has to justify every time it opens,
 * and the drawer opens on a pointer brushing the window's edge. It fades in on
 * hover — and on focus, so it isn't pointer-only — which makes it an answer to
 * a question rather than an announcement.
 *
 * A WEEK OPENS A LIST, it doesn't guess. A busy week holds fourteen notes;
 * linking the bar to the first one and counting the rest picked a destination
 * on the reader's behalf and hid thirteen. Clicking now opens the week above
 * the strip so you choose where to land.
 *
 * Built like the series popover (components/Series.tsx): always mounted and
 * toggled by `data-open` so it animates shut as well as open, `inert` when
 * closed to stay out of the tab order, an invisible backdrop to catch a click
 * outside, and Escape to dismiss. One panel, re-filled per week, rather than
 * twenty-five panels in the HTML for the one that might be opened.
 */
export default function ConstellationStrip({
  weeks,
  total,
}: {
  weeks: StripWeek[];
  total: number;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const { lang } = useLang();
  const root = useRef<HTMLElement>(null);

  const week = weeks.find((w) => w.start === open) ?? null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /**
   * Anything outside the strip closes it — the empty half of the sidebar, the
   * page behind it, a section link on the way to somewhere else.
   *
   * A listener rather than the usual backdrop element. A fixed overlay would
   * sit on top of the navigation directly above this and eat the first click
   * on every link in it; this only listens, so a click that closes the week
   * still does whatever else it was for.
   */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  /**
   * The drawer sliding shut collapses the week too, so it isn't still sitting
   * there the next time the sidebar opens — an open week is a thing you were
   * looking at, not a setting.
   *
   * Watched rather than told. The drawer stays mounted and merely translates
   * off-screen, so this asks the only question that actually matters — "am I
   * on screen?" — instead of subscribing to Chrome's open state. That keeps
   * the two components uncoupled (the strip is handed to Chrome as an opaque
   * element, so there's no prop to thread through anyway) and it holds for
   * every way the panel can go away: the pointer leaving during a peek, the
   * backdrop, Escape, a navigation.
   */
  useEffect(() => {
    const el = root.current;
    if (!open || !el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) setOpen(null);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [open]);

  // The drawer closes when the pointer leaves it, and a panel left open would
  // be waiting the next time it opened.
  useEffect(() => () => setOpen(null), []);

  return (
    <section
      ref={root}
      className="constellation"
      data-open={!!open}
      aria-labelledby="constellation-label"
    >
      {/* The reserved line above the strip. It holds the range and the running
          total, and a week's own summary takes it over on hover — one line,
          not two, so nothing in the drawer moves when either appears.
          It goes quiet entirely once a week is open, because the list below
          then names that week on the very next line and the two would be
          answering different questions an inch apart. */}
      <h2 id="constellation-label" className="constellation-label">
        <T
          en={`6 months · ${noteCount(total).en}`}
          uk={`6 місяців · ${noteCount(total).uk}`}
        />
      </h2>

      {/* In the drawer's flow, directly above the strip — not a floating card.
          These are the same rows as the section list higher up, because they
          are the same kind of thing: places in this site to go next. A panel
          with its own border, blur and shadow made a handful of links look
          like a different piece of software parked over the sidebar. */}
      <div
        id="constellation-week"
        className="constellation-open"
        data-open={!!open}
        inert={!open}
        aria-label={lang === "uk" ? "Нотатки цього тижня" : "Notes from this week"}
        role="group"
      >
        {week && (
          <>
            <p className="constellation-open-head">
              <T
                en={`${week.dateEn} · ${noteCount(week.notes.length).en}`}
                uk={`${week.dateUk} · ${noteCount(week.notes.length).uk}`}
              />
            </p>
            <ul className="constellation-notes">
              {week.notes.map((note) => (
                <li key={note.href}>
                  <Link
                    href={note.href}
                    className="press constellation-note"
                    onClick={() => setOpen(null)}
                  >
                    <T en={note.title} uk={note.titleUk ?? note.title} />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="constellation-strip">
        {weeks.map((w, i) => {
          if (w.notes.length === 0) {
            return <div key={w.start} className="constellation-week" aria-hidden />;
          }

          const count = noteCount(w.notes.length);
          // Where this column starts along the strip. Every bar is 6px with a
          // 1px gap, so it's arithmetic rather than a measurement — the label
          // below hangs off this to sit under its own week.
          const x = i * (BAR + GAP);
          // Near the right-hand end there isn't room for a label to grow
          // rightwards, so it hangs the other way instead. Only the index
          // knows how much room is left, which is why this isn't pure CSS.
          const late = x > STRIP_W - LABEL_W;

          return (
            <button
              key={w.start}
              type="button"
              className="constellation-week is-on"
              data-active={w.start === open}
              aria-expanded={w.start === open}
              aria-controls="constellation-week"
              onClick={() => setOpen((cur) => (cur === w.start ? null : w.start))}
              // Height and position are both data: there's no sensible number
              // of buckets to round a week's note count into, and the label
              // needs to know which column it belongs under.
              style={{ "--fill": w.fill, "--x": `${x}px` } as CSSProperties}
            >
              {/* The button's accessible name. Separate from the summary
                  below, which is hidden until hover — and a hidden element
                  is no name at all. */}
              {/* The button's accessible name gets the full sentence — the
                  abbreviations below are a glance, not something to hear read
                  out as "sixteen dot zero seven, fourteen en". */}
              <span className="sr-only">
                <T
                  en={`${w.dateEn} · ${count.en}`}
                  uk={`${w.dateUk} · ${count.uk}`}
                />
              </span>
              {/* "16.07 · 14n", under the strip. Short because it sits in a
                  176px column and has to say two things; the panel spells both
                  out in full once a week is actually opened. */}
              <span
                className="constellation-tip"
                data-align={late ? "end" : "start"}
                aria-hidden
              >
                <T
                  en={`${w.short} · ${w.notes.length}n`}
                  uk={`${w.short} · ${w.notes.length}н`}
                />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
