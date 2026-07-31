import Link from "next/link";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";
import { seriesPartLabel, type Series } from "@/lib/series";
import { displayDate, displayDateUk } from "@/lib/vault";

/**
 * The other parts of the series this note belongs to.
 *
 * Sits above the prev/next row, which is a different question: those are the
 * neighbours in the *section*, these are the neighbours in the *argument*.
 * Every part is listed rather than just the one either side — a series is
 * read from the start, and someone arriving at part four from search needs
 * part one, not part three.
 *
 * The current note is in the list, unlinked and marked. Removing it would
 * make the numbers lie about where you are.
 */
export default function Series({ series }: { series: Series }) {
  return (
    <nav id="series" className="series" aria-label="Series">
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
                  <T en={displayDate(part.date)} uk={displayDateUk(part.date)} />
                </time>
              )}
            </>
          );

          return (
            <li key={part.href} className="series-item">
              {part.current ? (
                /* aria-current does the announcing; the dot is decoration. */
                <span className="series-link series-current" aria-current="true">
                  {label}
                </span>
              ) : (
                <Link href={part.href} className="series-link">
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * The one-line version for the header meta row: "Part 2 of 5", linking down
 * to the full list. A note that is part of something should say so where the
 * date and reading time are, before the reader starts in the middle.
 */
export function SeriesBadge({ series }: { series: Series }) {
  return (
    <a href="#series" className="series-badge">
      <T {...seriesPartLabel(series.index, series.total)} />
    </a>
  );
}
