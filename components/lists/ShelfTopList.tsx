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

            {/* TWO VERDICTS, kept visibly apart (DECISIONS #114). The stars
                are Kyrylo's out of five and appear only where he has actually
                given one; the number is IMDb's out of ten and is somebody
                else's. Drawing IMDb's average as stars would put a stranger's
                opinion in his handwriting, which is the one thing this shelf
                must not do.

                The number is LABELLED rather than left bare. Side by side a
                bare figure reads as the stars written out in digits — the
                exact misreading that made this change necessary — and there is
                no column header on a list of rows to carry the label instead. */}
            <span className="top-rating">
              {typeof item.rating === "number" && (
                <Stars rating={item.rating} />
              )}
              {typeof item.imdb === "number" && (
                <span className="top-imdb">
                  <span className="top-score">{item.imdb.toFixed(1)}</span>
                  {/* Under the number, not beside it: stacked, the label reads
                      as a caption belonging to the figure above it, and the
                      pair takes one column instead of two — which is width the
                      description gets back on every row. */}
                  <span className="top-imdb-mark" aria-hidden>
                    IMDb
                  </span>
                  <span className="sr-only">
                    <T {...ui.imdbRating} />
                  </span>
                </span>
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
