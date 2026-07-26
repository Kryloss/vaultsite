import Link from "next/link";
import type { ListProps } from "@/lib/section-types";
import { shelfGroups, shelfHighlights } from "@/lib/shelf";
import ShelfCard from "@/components/lists/ShelfCard";
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

  // What's open and what's queued come first, across every medium — the two
  // things you'd actually want off a shelf. They repeat inside their medium
  // rows below, which is how every streaming shelf behaves.
  const groups = [...shelfHighlights(entries), ...shelfGroups(entries)];

  return (
    <div className="mt-8 flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.medium}>
          <h2 className="text-lg font-semibold tracking-tight text-[var(--text)]">
            {/* "Everything else" and the status rows have no medium page to
                link to. The chevron is shown even for a single item so the
                page stays discoverable. */}
            {group.medium === "unsorted" ||
            group.medium === "in-progress" ||
            group.medium === "queued" ? (
              <T {...group.label} />
            ) : (
              <Link
                href={`/${section.slug}/type/${group.slug}`}
                className="group inline-flex items-center gap-0.5"
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

          {/* Horizontal scroller. Cards are fixed-width flex children; videos
              get a wider box because they're 16:9 rather than 2:3. */}
          <ul className="shelf-row mt-3 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-1">
            {group.items.map((item) => (
              <li
                key={item.slug}
                className={`shrink-0 snap-start ${
                  item.isVideo ? "w-[280px]" : "w-[150px]"
                }`}
              >
                <ShelfCard
                  item={item}
                  sectionSlug={section.slug}
                  showRating={false}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
