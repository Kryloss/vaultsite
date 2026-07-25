import type { ListProps } from "@/lib/section-types";
import { resolveCoverUrl } from "@/lib/markdown";
import { youtubeId, youtubeThumbnail } from "@/lib/youtube";
import ShelfGridClient, {
  type ShelfItem,
} from "@/components/lists/ShelfGridClient";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";

/**
 * "shelf" section type (server side) — vertical 2:3 covers for books, movies,
 * and TV shows, plus wide 16:9 cards for YouTube videos, with medium filter
 * chips. Entry frontmatter:
 *
 *   medium: book | movie | show | video   (chip grouping; anything goes)
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

  const items: ShelfItem[] = entries.map((entry) => {
    const medium =
      typeof entry.meta.medium === "string"
        ? entry.meta.medium.toLowerCase()
        : undefined;

    // `video:` (or a `url:`) pointing at YouTube gives us the thumbnail for
    // free — an explicit `cover:` still wins if one is set.
    const link = entry.meta.video ?? entry.meta.url;
    const videoId = typeof link === "string" ? youtubeId(link) : undefined;
    const cover = resolveCoverUrl(entry.sectionDir, entry.meta.cover);

    return {
      slug: entry.slug,
      title: entry.title,
      titleUk: entry.titleUk,
      author:
        typeof entry.meta.author === "string" ? entry.meta.author : undefined,
      medium,
      coverUrl: cover ?? (videoId ? youtubeThumbnail(videoId) : undefined),
      coverFit:
        entry.meta.coverFit === "contain" ? ("contain" as const) : undefined,
      rating:
        typeof entry.meta.rating === "number" ? entry.meta.rating : undefined,
      // Wide card + play badge. Driven by the medium so an entry still reads as
      // a video even if the link lives in the body rather than frontmatter.
      isVideo: medium === "video" || medium === "youtube" || Boolean(videoId),
    };
  });

  return <ShelfGridClient sectionSlug={section.slug} items={items} />;
}
