import type { CSSProperties } from "react";
import Link from "next/link";
import T from "@/components/T";
import { displayDate, displayDateUk } from "@/lib/vault";
import {
  WEEKS,
  buildConstellation,
  type ConstellationNote,
} from "@/lib/constellation";

/**
 * Six months of writing in the sidebar footer, a bar per week.
 *
 * Scattered across folders, twenty-five notes read as a list. Laid out in
 * time they read as a habit — which is the true thing about them, and the one
 * thing the folder tree can't show.
 *
 * A WEEK PER BAR, and the day-by-day version is deliberately gone: see the
 * header of lib/constellation.ts for what the real vault looked like through
 * it. SIX MONTHS because the drawer is 224px wide with 24px gutters, and 25
 * bars at 6px plus a gap is 174px of the 176 available — the width, the gap
 * and `WEEKS` are one decision written in two files.
 *
 * Built at build time from `date:` frontmatter, so it is never stale and never
 * needs maintaining: write a note, a bar grows.
 *
 * No client JavaScript. Weeks with notes are real links — keyboard-reachable,
 * working without JS — and the label is a `:hover` rule, not a listener. Empty
 * weeks are plain divs hidden from screen readers, because "nothing that week"
 * is not information anybody needs read out twenty times.
 */
export default function Constellation({
  notes,
  today,
}: {
  notes: ConstellationNote[];
  /** `YYYY-MM-DD`. Passed in so the strip is deterministic — see lib/constellation.ts. */
  today: string;
}) {
  const grid = buildConstellation(notes, today, WEEKS);
  // An empty window would draw a flat line whose only message is that the site
  // is quiet. Better to show nothing at all.
  if (grid.total === 0) return null;

  return (
    <section className="constellation" aria-labelledby="constellation-label">
      <h2 id="constellation-label" className="constellation-label">
        <T
          en={`${grid.total} notes · 6 months`}
          uk={`${grid.total} нотаток · 6 місяців`}
        />
      </h2>

      <div className="constellation-strip">
        {grid.weeks.map((week) => {
          if (week.notes.length === 0) {
            return <div key={week.start} className="constellation-week" aria-hidden />;
          }

          const [first, ...rest] = week.notes;
          // One bar, one destination: the week's first note, with the others
          // counted. This is a 6px bar in a navigation drawer, not a place to
          // grow a popover.
          const suffix = rest.length ? ` +${rest.length}` : "";
          const en = `${first.title}${suffix} · ${displayDate(week.start)}`;
          const uk = `${first.titleUk ?? first.title}${suffix} · ${displayDateUk(week.start)}`;

          return (
            <Link
              key={week.start}
              href={first.href}
              className="constellation-week is-on"
              // Height is data, so it's an inline custom property rather than
              // a class: there is no sensible number of buckets to round a
              // week's note count into.
              style={{ "--fill": week.fill } as CSSProperties}
            >
              {/* The link's accessible name. Separate from the label below,
                  which is hidden until hover — and a hidden element is no
                  name at all. */}
              <span className="sr-only">
                <T en={en} uk={uk} />
              </span>
              <span className="constellation-tip" aria-hidden>
                <T en={en} uk={uk} />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
