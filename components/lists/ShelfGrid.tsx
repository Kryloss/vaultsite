import type { ListProps } from "@/lib/section-types";
import { assetUrl } from "@/lib/markdown";
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

  const items: ShelfItem[] = entries.map((entry) => {
    const cover = cleanCover(entry.meta.cover);
    return {
      slug: entry.slug,
      title: entry.title,
      author:
        typeof entry.meta.author === "string" ? entry.meta.author : undefined,
      medium:
        typeof entry.meta.medium === "string"
          ? entry.meta.medium.toLowerCase()
          : undefined,
      coverUrl: cover ? assetUrl(entry.sectionDir, cover) : undefined,
    };
  });

  return <ShelfGridClient sectionSlug={section.slug} items={items} />;
}

/** Accepts "cover.jpg", "![[cover.jpg]]" or "[[cover.jpg]]" from frontmatter. */
function cleanCover(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.trim().replace(/^!?\[\[/, "").replace(/\]\]$/, "");
}
