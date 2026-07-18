import type { ListProps } from "@/lib/section-types";
import { resolveCoverUrl } from "@/lib/markdown";
import ShelfGridClient, {
  type ShelfItem,
} from "@/components/lists/ShelfGridClient";

/**
 * "shelf" section type (server side) — vertical 2:3 covers for books, movies,
 * and TV shows, with medium filter chips. Entry frontmatter:
 *
 *   medium: book | movie | show   (chip grouping; anything goes)
 *   author: Yuval Noah Harari     (or director/creator for film & TV)
 *   cover: sapiens.jpg            (image inside the section folder)
 *   coverFit: contain             (optional — letterbox wide art like logos
 *                                  instead of cropping it to fill the card)
 *   rating: 4.5                   (optional — 0–5 stars, halves allowed)
 */
export default function ShelfGrid({ section, entries }: ListProps) {
  if (entries.length === 0) {
    return (
      <p className="mt-10 text-sm text-[var(--text-tertiary)]">
        Nothing here yet. Add a .md file next to this section&rsquo;s main.md in
        your vault and it will show up automatically.
      </p>
    );
  }

  const items: ShelfItem[] = entries.map((entry) => ({
    slug: entry.slug,
    title: entry.title,
    titleUk: entry.titleUk,
    author:
      typeof entry.meta.author === "string" ? entry.meta.author : undefined,
    medium:
      typeof entry.meta.medium === "string"
        ? entry.meta.medium.toLowerCase()
        : undefined,
    coverUrl: resolveCoverUrl(entry.sectionDir, entry.meta.cover),
    coverFit: entry.meta.coverFit === "contain" ? ("contain" as const) : undefined,
    rating:
      typeof entry.meta.rating === "number" ? entry.meta.rating : undefined,
  }));

  return <ShelfGridClient sectionSlug={section.slug} items={items} />;
}
