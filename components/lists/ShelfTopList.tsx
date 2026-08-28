import Link from "next/link";
import type { CSSProperties } from "react";
import NewBadge from "@/components/NewBadge";
import Stars from "@/components/Stars";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";
import { sortForTop, type ShelfItem } from "@/lib/shelf";

/**
 * Films and shows as a ranked list — the IMDb Top 250 grammar: position,
 * small cover, title, one line about it, rating.
 *
 * This is what the FIRST chip on a movie or show medium page opens, in place
 * of the grid of every cover (DECISIONS #113). The category chips behind it
 * are untouched and still open the grid: choosing "Crime" is choosing a set
 * to look at, and covers are how you look at a set. Choosing "Top" is asking
 * an ordered question, and an ordered question wants rows — a grid can carry
 * a rank number but nobody reads a grid in order, and it has no room for the
 * sentence that says why the thing is there.
 *
 * The list is deliberately NOT rated-only. Almost nothing on this shelf has a
 * rating yet, so a rated-only list would be nearly empty and the page would
 * lose its index of everything; unrated titles sit under the rated ones in
 * date order and say so plainly. See `sortForTop`.
 *
 * Server component: the ordering is a build-time sort of props, there is no
 * state, and the rank is just the array index.
 */
export default function ShelfTopList({
  items,
  sectionSlug,
}: {
  items: ShelfItem[];
  sectionSlug: string;
}) {
  const ranked = sortForTop(items);

  return (
    <ol className="stagger top-list mt-8">
      {ranked.map((item, i) => (
        <li key={item.slug} className="top-slot">
          <Link
            href={`/${sectionSlug}/${item.slug}`}
            className="top-row press press-soft"
          >
            {/* Tabular so the column is a column: the numbers are read down
                the page, not across, and proportional digits make a ragged
                left edge out of 1 next to 11. */}
            <span className="top-rank" aria-hidden>
              {i + 1}
            </span>

            {item.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.coverUrl}
                srcSet={item.coverSrcSet}
                /* Painted at 44px wide, so the 256w variant is far and away
                   the right pick — without `sizes` the browser assumes 100vw
                   and pulls the full poster for a thumbnail. */
                sizes="44px"
                alt=""
                aria-hidden
                className="top-art"
                style={
                  item.coverBlur
                    ? ({
                        backgroundImage: `url("${item.coverBlur}")`,
                      } as CSSProperties)
                    : undefined
                }
                loading="lazy"
              />
            ) : (
              /* Keeps the grid column filled so the text of a coverless row
                 still lines up with every row above it. */
              <span className="top-art top-art-empty" aria-hidden />
            )}

            <span className="top-title">
              <T en={item.title} uk={item.titleUk} />
              <NewBadge date={item.date} />
            </span>

            {/* The rating, or an explicit absence. Blank would read as a
                rendering fault on a page whose first chip says "Top" — but
                the absence is spelled with a dash rather than the words,
                because almost every row is unrated today and "Not rated yet"
                set eighteen times over is a column of noise that costs the
                description the width it needs. The words stay for a screen
                reader, which has no column to lose. */}
            <span className="top-rating">
              {typeof item.rating === "number" ? (
                <>
                  <Stars rating={item.rating} />
                  <span className="top-score">{item.rating.toFixed(1)}</span>
                </>
              ) : (
                <>
                  <span className="top-unrated" aria-hidden>
                    —
                  </span>
                  <span className="sr-only">
                    <T {...ui.unrated} />
                  </span>
                </>
              )}
            </span>

            {item.description && (
              <span className="top-desc">
                <T en={item.description} uk={item.descriptionUk} />
              </span>
            )}
          </Link>
        </li>
      ))}
    </ol>
  );
}
