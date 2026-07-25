/**
 * Shelf model — shared by the section page (Netflix-style rows) and the
 * per-medium pages at /<section>/type/<medium>.
 *
 * Everything here runs at build time; the shelf has no client-side state since
 * the medium rows replaced the old filter chips.
 */
import { slugify, type Entry, type Section } from "./vault";
import { resolveCoverUrl } from "./markdown";
import { youtubeId, youtubeThumbnail } from "./youtube";
import { ui, type Str } from "./ui-strings";

export interface ShelfItem {
  slug: string;
  title: string;
  titleUk?: string;
  author?: string;
  medium?: string;
  coverUrl?: string;
  /** "contain" letterboxes wide art (logos) instead of cropping to fill. */
  coverFit?: "contain";
  /** 0–5, halves allowed. */
  rating?: number;
  /** Renders as a wide 16:9 card with a play badge instead of a 2:3 cover. */
  isVideo?: boolean;
}

export interface ShelfGroup {
  /** Canonical medium key from frontmatter, e.g. "video". */
  medium: string;
  /** URL segment, e.g. "videos". */
  slug: string;
  label: Str;
  items: ShelfItem[];
}

/** Bilingual labels for known mediums; anything else is shown capitalised. */
const MEDIUM_LABELS: Record<string, Str> = {
  book: ui.mediumBooks,
  movie: ui.mediumMovies,
  show: ui.mediumShows,
  video: ui.mediumVideos,
  youtube: ui.mediumVideos,
};

/**
 * Row order on the section page. Mediums not listed here follow, sorted
 * alphabetically, so a new `medium:` value never disappears — it just lands
 * at the bottom until it's given a place here.
 */
const MEDIUM_ORDER = ["video", "movie", "show", "book"];

/** Items with no `medium:` at all are grouped under this row. */
const UNSORTED = "unsorted";

export function mediumLabel(medium: string): Str {
  const cap = medium.charAt(0).toUpperCase() + medium.slice(1);
  return MEDIUM_LABELS[medium] ?? { en: cap, uk: cap };
}

/** "video" → "videos" (the URL segment). Already-plural values are left alone. */
export function mediumSlug(medium: string): string {
  return slugify(medium.endsWith("s") ? medium : `${medium}s`);
}

/** Frontmatter → the shape the cards render from. */
export function toShelfItem(entry: Entry): ShelfItem {
  const medium =
    typeof entry.meta.medium === "string"
      ? entry.meta.medium.toLowerCase()
      : undefined;

  // `video:` (or `url:`) pointing at YouTube gives us the thumbnail for free —
  // an explicit `cover:` still wins if one is set.
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
    isVideo: medium === "video" || medium === "youtube" || Boolean(videoId),
  };
}

/** Group a section's entries into medium rows, in display order. */
export function shelfGroups(entries: Entry[]): ShelfGroup[] {
  const byMedium = new Map<string, ShelfItem[]>();
  for (const entry of entries) {
    const item = toShelfItem(entry);
    const key = item.medium ?? UNSORTED;
    const bucket = byMedium.get(key);
    if (bucket) bucket.push(item);
    else byMedium.set(key, [item]);
  }

  const rank = (m: string) => {
    if (m === UNSORTED) return Number.MAX_SAFE_INTEGER; // always last
    const i = MEDIUM_ORDER.indexOf(m);
    return i === -1 ? MEDIUM_ORDER.length : i;
  };

  return [...byMedium.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([medium, items]) => ({
      medium,
      slug: mediumSlug(medium),
      label: medium === UNSORTED ? ui.shelfEverythingElse : mediumLabel(medium),
      items,
    }));
}

/** Every medium URL segment in a section — used by generateStaticParams. */
export function shelfMediumSlugs(entries: Entry[]): string[] {
  return shelfGroups(entries)
    .filter((g) => g.medium !== UNSORTED)
    .map((g) => g.slug);
}

/** Find one group by its URL segment, e.g. "videos". */
export function shelfGroupBySlug(
  entries: Entry[],
  slug: string
): ShelfGroup | undefined {
  return shelfGroups(entries).find((g) => g.slug === slug);
}

/** Section types that use the shelf layout (mirrors lib/section-types.tsx). */
export const SHELF_TYPES = ["shelf", "books"];

export function isShelfSection(section: Section): boolean {
  return SHELF_TYPES.includes(section.type);
}
