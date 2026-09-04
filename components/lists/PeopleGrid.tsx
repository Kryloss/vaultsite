import { Suspense } from "react";
import type { ListProps } from "@/lib/section-types";
import { resolveCoverUrl } from "@/lib/markdown";
import { blurFor, srcSetFor } from "@/lib/blur";
import { parseCategories } from "@/lib/vault";
import PeopleCards, { type PersonRow } from "@/components/lists/PeopleCards";
import PeopleGridClient from "@/components/lists/PeopleGridClient";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";

/**
 * "people" section type (server side) — two cards to a row from 640px, the
 * portrait beside a panel carrying the name and `description:`; one full-width
 * portrait with a corner name card below that. Category filter chips either
 * way. See DECISIONS #125.
 *
 * Each entry note can set:
 *   cover: fedorov.jpg      (a file inside the same section folder — preferred)
 *   cover: https://…        (remote URL fallback)
 *   categories: [Ukraine, Tech]   (or a single `category:`)
 * Without a cover, a tile with the person's initials is shown instead.
 *
 * Filtering works exactly like the posts list: chips are links to
 * `?category=…`, read by the client half via useSearchParams(), so a chip on a
 * person's own page lands here pre-filtered. See DECISIONS #14 for why these
 * aren't separate pages the way the shelf's categories are.
 */
export default function PeopleGrid({ section, entries }: ListProps) {
  if (entries.length === 0) {
    return (
      <p className="mt-10 text-sm text-[var(--text-tertiary)]">
        <T {...ui.emptyState} />
      </p>
    );
  }

  const rows: PersonRow[] = entries.map((entry) => ({
    slug: entry.slug,
    title: entry.title,
    titleUk: entry.titleUk,
    description: entry.description,
    descriptionUk: entry.descriptionUk,
    cover: resolveCoverUrl(entry.sectionDir, entry.meta.cover),
    coverBlur: blurFor(resolveCoverUrl(entry.sectionDir, entry.meta.cover)),
    coverSrcSet: srcSetFor(resolveCoverUrl(entry.sectionDir, entry.meta.cover)),
    contain: entry.meta.coverFit === "contain" || undefined,
    categories: parseCategories(entry.meta),
    date: entry.date,
  }));

  const categories: string[] = [];
  for (const row of rows)
    for (const c of row.categories)
      if (!categories.includes(c)) categories.push(c);

  // The client half uses useSearchParams(), which Next requires behind a
  // Suspense boundary and renders on the client. The fallback is the same grid
  // unfiltered, so the static HTML still contains everyone.
  return (
    <Suspense
      fallback={
        <PeopleCards
          sectionSlug={section.slug}
          rows={rows}
          categories={categories}
          active={null}
        />
      }
    >
      <PeopleGridClient sectionSlug={section.slug} rows={rows} />
    </Suspense>
  );
}
