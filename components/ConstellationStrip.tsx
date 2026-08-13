"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import T from "@/components/T";
import { useLang } from "@/components/useLang";

/**
 * A week's column, already formatted. Everything the strip needs at runtime
 * arrives on this prop — the dates are rendered server-side, so this file
 * never imports `lib/vault.ts` and its `fs` calls stay out of the bundle.
 * Same split as PostList → PostListClient.
 */
export interface StripWeek {
  /** Monday, `YYYY-MM-DD`. The React key and the open-state token. */
  start: string;
  /** Bar height, 0–1, against the busiest week. */
  fill: number;
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

  const week = weeks.find((w) => w.start === open) ?? null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // The drawer closes when the pointer leaves it, and a panel left open would
  // be waiting the next time it opened.
  useEffect(() => () => setOpen(null), []);

  return (
    <section className="constellation" aria-labelledby="constellation-label">
      {/* The reserved line above the strip. It holds the running total, and a
          week's own summary takes it over on hover — one line, not two, so
          nothing in the drawer moves when either appears. */}
      <h2 id="constellation-label" className="constellation-label">
        <T
          en={`${total} notes · 6 months`}
          uk={`${total} нотаток · 6 місяців`}
        />
      </h2>

      <div className="constellation-body">
        <span
          className="constellation-backdrop"
          data-open={!!open}
          aria-hidden
          onClick={() => setOpen(null)}
        />

        <div
          id="constellation-week"
          className="constellation-panel"
          data-open={!!open}
          inert={!open}
          aria-label={lang === "uk" ? "Нотатки цього тижня" : "Notes from this week"}
          role="group"
        >
          {week && (
            <>
              <p className="constellation-panel-head">
                <T
                  en={`${week.dateEn} · ${week.notes.length} ${week.notes.length === 1 ? "note" : "notes"}`}
                  uk={`${week.dateUk} · ${week.notes.length}`}
                />
              </p>
              <ul className="constellation-notes">
                {week.notes.map((note) => (
                  <li key={note.href}>
                    <Link
                      href={note.href}
                      className="constellation-note"
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
          {weeks.map((w) => {
            if (w.notes.length === 0) {
              return <div key={w.start} className="constellation-week" aria-hidden />;
            }

            const count = w.notes.length;
            const summary = (date: string, word: string) =>
              `${date} · ${count} ${word}`;

            return (
              <button
                key={w.start}
                type="button"
                className="constellation-week is-on"
                data-active={w.start === open}
                aria-expanded={w.start === open}
                aria-controls="constellation-week"
                onClick={() => setOpen((cur) => (cur === w.start ? null : w.start))}
                // Height is data — there's no sensible number of buckets to
                // round a week's note count into, so it rides a property.
                style={{ "--fill": w.fill } as CSSProperties}
              >
                {/* The button's accessible name. Separate from the summary
                    below, which is hidden until hover — and a hidden element
                    is no name at all. */}
                <span className="sr-only">
                  <T
                    en={summary(w.dateEn, count === 1 ? "note" : "notes")}
                    uk={summary(w.dateUk, "нот.")}
                  />
                </span>
                <span className="constellation-tip" aria-hidden>
                  <T
                    en={summary(w.dateEn, count === 1 ? "note" : "notes")}
                    uk={summary(w.dateUk, "нот.")}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
