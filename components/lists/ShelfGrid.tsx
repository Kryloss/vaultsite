import Link from "next/link";
import type { ListProps } from "@/lib/section-types";
import { shelfGroups } from "@/lib/shelf";
import ShelfCard from "@/components/lists/ShelfCard";
import ShelfRow from "@/components/lists/ShelfRow";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";

/**
 * "shelf" section type — one horizontally-scrolling row per medium (videos,
 * movies, shows, books), Netflix style. Each row header links to
 * /<section>/type/<medium>, which lists everything of that type in a grid.
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
          <h2 className="text-lg font-semibold tracking-tight text-[var(--text)]">
            {/* "Everything else" has no medium page to link to. The chevron is
                shown even for a single item so the page stays discoverable. */}
            {group.medium === "unsorted" ? (
              <T {...group.label} />
            ) : (
              <Link
                href={`/${section.slug}/type/${group.slug}`}
                className="group press inline-flex items-center gap-0.5"
              >
                <T {...group.label} />
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="h-[18px] w-[18px] shrink-0 translate-y-px text-[var(--text-tertiary)] transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--text)]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </Link>
            )}
          </h2>

          {/* Horizontal scroller. Every row is the same height — the card
              WIDTHS are computed from `--shelf-card-h` (globals.css) and the
              medium's aspect ratio, so a 16:9 video card is wide rather than
              short and the shelves down the page line up. */}
          <ShelfRow className="shelf-row stagger mt-3 flex snap-x snap-proximity gap-5 overflow-x-auto pb-1">
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
        </section>
      ))}
    </div>
  );
}
