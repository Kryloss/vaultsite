/**
 * Shelf model — shared by the section page (Netflix-style rows) and the
 * per-medium pages at /<section>/type/<medium>.
 *
 * Everything here runs at build time; the shelf has no client-side state since
 * the medium rows replaced the old filter chips.
 */
import { parseCategories, slugify, type Entry, type Section } from "./vault";
import { resolveCoverUrl } from "./markdown";
import { blurFor } from "./blur";
import { youtubeId, youtubeThumbnail } from "./youtube";
import { ui, type Str } from "./ui-strings";
import { categoryLabel } from "./categories";

// Re-exported so server callers can keep importing it from here.
export { categoryLabel };

export interface ShelfItem {
  slug: string;
  title: string;
  titleUk?: string;
  author?: string;
  medium?: string;
  coverUrl?: string;
  /** Base64 blur-up placeholder for `coverUrl` — see lib/blur.ts. */
  coverBlur?: string;
  /** "contain" letterboxes wide art (logos) instead of cropping to fill. */
  coverFit?: "contain";
  /** 0–5, halves allowed. */
  rating?: number;
  /** Renders as a 16:9 card instead of a 2:3 cover. */
  isVideo?: boolean;
  /**
   * Reading state from `status:`. Undefined means finished, which is the
   * common case and stays unlabelled so the shelf isn't covered in pills.
   */
  status?: "progress" | "queued";
  /** Badge text for `status` — verb matched to the medium. */
  statusLabel?: Str;
  /** `categories:` frontmatter — filter chips on the medium page. */
  categories: string[];
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

/** `status:` values that mean "part-way through". */
const IN_PROGRESS = new Set(["reading", "watching", "current", "in-progress"]);

/** `status:` values that mean "haven't started — it's in the queue". */
const QUEUED = new Set(["want", "queued", "queue", "to-read", "to-watch", "backlog", "planned"]);

/** Mediums you watch rather than read — decides which verb the badge uses. */
const WATCHED = new Set(["movie", "show", "video", "youtube"]);

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

  // `status:` badges the card and pins it to a row at the top of the shelf.
  // Anything unrecognised — or nothing at all — reads as finished.
  const raw =
    typeof entry.meta.status === "string"
      ? entry.meta.status.trim().toLowerCase()
      : undefined;
  const status: ShelfItem["status"] = !raw
    ? undefined
    : IN_PROGRESS.has(raw)
      ? "progress"
      : QUEUED.has(raw)
        ? "queued"
        : undefined;
  // Books are read, everything screen-shaped is watched.
  const watched = (medium && WATCHED.has(medium)) || Boolean(videoId);
  const statusLabel =
    status === "progress"
      ? watched
        ? ui.currentlyWatching
        : ui.currentlyReading
      : status === "queued"
        ? watched
          ? ui.wantToWatch
          : ui.wantToRead
        : undefined;

  return {
    slug: entry.slug,
    title: entry.title,
    titleUk: entry.titleUk,
    author:
      typeof entry.meta.author === "string" ? entry.meta.author : undefined,
    medium,
    coverUrl: cover ?? (videoId ? youtubeThumbnail(videoId) : undefined),
    // Only vault files have one; YouTube thumbnails are remote.
    coverBlur: blurFor(cover),
    coverFit:
      entry.meta.coverFit === "contain" ? ("contain" as const) : undefined,
    rating:
      typeof entry.meta.rating === "number" ? entry.meta.rating : undefined,
    isVideo: medium === "video" || medium === "youtube" || Boolean(videoId),
    status,
    statusLabel,
    categories: parseCategories(entry.meta),
  };
}

/*
 * No status rows. Reading state shows as a badge on the cover, in the medium
 * row the item already lives in — a separate "Up next" or "In progress" row
 * duplicated cards a few hundred pixels apart and made the shelf longer
 * without making anything easier to find. The rows are one medium each, and
 * they stay that way.
 */

/** Every category used within one medium, alphabetical. */
export function groupCategories(group: ShelfGroup): string[] {
  const seen: string[] = [];
  for (const item of group.items)
    for (const c of item.categories) if (!seen.includes(c)) seen.push(c);
  return seen.sort((a, b) => a.localeCompare(b));
}

/** "Sci-Fi" → "sci-fi" (the URL segment). */
export function categorySlug(category: string): string {
  return slugify(category);
}

/** Resolve a category URL segment back to its display name. */
export function categoryFromSlug(
  group: ShelfGroup,
  slug: string
): string | undefined {
  return groupCategories(group).find((c) => categorySlug(c) === slug);
}

/** Items in a group carrying `category`. */
export function itemsInCategory(
  group: ShelfGroup,
  category: string
): ShelfItem[] {
  return group.items.filter((i) => i.categories.includes(category));
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
