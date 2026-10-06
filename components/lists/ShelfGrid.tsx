import Link from "next/link";
import type { ListProps } from "@/lib/section-types";
import { shelfGroups } from "@/lib/shelf";
import ShelfCard from "@/components/lists/ShelfCard";
import ShelfRow from "@/components/lists/ShelfRow";
import BookSpines from "@/components/lists/BookSpines";
import T from "@/components/T";
import { ArrowGlyph } from "@/components/icons";
import { ui } from "@/lib/ui-strings";

/**
 * "shelf" section type — one row per medium (videos, movies, shows, books).
 * Each row header links to /<section>/type/<medium>, which lists everything of
 * that type in a grid of covers.
 *
 * Three of the four rows are horizontally-scrolling Netflix strips. BOOKS are
 * a shelf of standing spines instead (components/lists/BookSpines.tsx): it
 * fits the whole collection in one screen without a scroller, and it is the
 * row that looks like the thing the section is named after. DECISIONS #110.
 *
 * Rows exist because mixing 16:9 video cards and 2:3 covers in one grid leaves
 * vertical holes: a grid row is as tall as its tallest item. Grouping by medium
 * means every row holds one shape.
 *
 * Fully server-rendered — the medium rows replaced the old filter chips, so
 * there's no client-side state left. Entry frontmatter:
 *
 *   medium: book | movie | show | video   (row grouping; anything goes)
 *   author: Yuval Noah Harari     (or director/creator/channel)
 *   cover: sapiens.jpg            (image inside the section folder)
 *   coverFit: contain             (optional — letterbox wide art like logos
 *                                  instead of cropping it to fill the card)
 *   rating: 4.5                   (optional — 0–5 stars, halves allowed)
 *   video: https://youtu.be/…     (medium: video — the thumbnail is derived
 *                                  from the link, so `cover:` is optional)
 */
export default function ShelfGrid({ section, entries }: ListProps) {
  if (entries.length === 0) {
    return (
      <p className="mt-10 text-sm text-[var(--text-tertiary)]">
        <T {...ui.emptyState} />
      </p>
    );
  }

  const groups = shelfGroups(entries);

  return (
    <div className="mt-8 flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.medium}>
          <h2
            /* Books only: that row's scroller reserves padding for the hover
               cover and overlaps this heading, so it has to sit above it to
               stay clickable. See `.book-shelf-heading`. */
            className={`text-lg font-semibold tracking-tight text-[var(--text)]${
              group.medium === "book" ? " book-shelf-heading" : ""
            }`}
          >
            {/* "Everything else" has no medium page to link to. The arrow is
                shown even for a single item so the page stays discoverable.
                `action-link` is what moves it — see `.arrow-glyph` in
                globals.css. */}
            {group.medium === "unsorted" ? (
              <T {...group.label} />
            ) : (
              <Link
                href={`/${section.slug}/type/${group.slug}`}
                className="action-link press inline-flex items-center"
              >
                <T {...group.label} />
                <span className="shelf-heading-arrow">
                  <ArrowGlyph />
                </span>
              </Link>
            )}
          </h2>

          {group.medium === "book" ? (
            /* Books stand up. Taller than the other rows, but sitting under
               its heading at the SAME `mt-3` every other row uses — matched by
               using the same class rather than by a number tuned to look
               equal. It needs no scroller (eleven spines fit the column with
               room to spare) and it is the row that looks like what the
               section is called. Their covers are not lost: the medium page
               behind this heading is a grid of them. See BookSpines.tsx. */
            <BookSpines
              items={group.items}
              sectionSlug={section.slug}
              className="book-shelf-gap"
            />
          ) : (
            /* Horizontal scroller. Every row is the same height — the card
               WIDTHS are computed from `--shelf-card-h` (globals.css) and the
               medium's aspect ratio, so a 16:9 video card is wide rather than
               short and the shelves down the page line up. Books opt out of
               that agreement on purpose: a spine is a different object from a
               card, with its own hairline under it, so it is not being
               dragged to a height that belongs to artwork. */
            <ShelfRow className="shelf-row stagger mt-1 flex snap-x snap-proximity gap-5 overflow-x-auto pb-1 pt-2">
              {group.items.map((item) => (
                <li
                  key={item.slug}
                  className={`shrink-0 snap-start ${
                    item.isVideo ? "shelf-card-wide" : "shelf-card-tall"
                  }`}
                >
                  <ShelfCard
                    item={item}
                    sectionSlug={section.slug}
                    showRating={false}
                  />
                </li>
              ))}
            </ShelfRow>
          )}
        </section>
      ))}
    </div>
  );
}
