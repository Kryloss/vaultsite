/**
 * Shelf model — shared by the section page (Netflix-style rows) and the
 * per-medium pages at /<section>/type/<medium>.
 *
 * Everything here runs at build time; the shelf has no client-side state since
 * the medium rows replaced the old filter chips.
 */
import { parseCategories, slugify, type Entry, type Section } from "./vault";
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
  /** Renders as a 16:9 card instead of a 2:3 cover. */
  isVideo?: boolean;
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
 * Ukrainian names for the category vocabulary in docs/CONTENT-WORKFLOW.md.
 * Anything missing falls back to the English string in both languages, so a
 * new `categories:` value never breaks — it just reads the same either way
 * until it's given a translation here.
 *
 * Keys are matched case-insensitively; URL slugs stay English, so adding a
 * translation never changes a page's address.
 */
const CATEGORY_LABELS: Record<string, Str> = {
  // video
  entertainment: { en: "Entertainment", uk: "Розваги" },
  politics: { en: "Politics", uk: "Політика" },
  tech: { en: "Tech", uk: "Технології" },
  education: { en: "Education", uk: "Освіта" },
  music: { en: "Music", uk: "Музика" },
  popsci: { en: "PopSci", uk: "Наукпоп" },
  // movie / show
  "sci-fi": { en: "Sci-Fi", uk: "Фантастика" },
  thriller: { en: "Thriller", uk: "Трилер" },
  drama: { en: "Drama", uk: "Драма" },
  action: { en: "Action", uk: "Бойовик" },
  comedy: { en: "Comedy", uk: "Комедія" },
  documentary: { en: "Documentary", uk: "Документальне" },
  anime: { en: "Anime", uk: "Аніме" },
  // book
  nonfiction: { en: "Nonfiction", uk: "Нонфікшн" },
  fiction: { en: "Fiction", uk: "Художня література" },
  history: { en: "History", uk: "Історія" },
  science: { en: "Science", uk: "Наука" },
  biography: { en: "Biography", uk: "Біографія" },
};

/** Bilingual label for a category name from frontmatter. */
export function categoryLabel(category: string): Str {
  return (
    CATEGORY_LABELS[category.trim().toLowerCase()] ?? {
      en: category,
      uk: category,
    }
  );
}

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
    categories: parseCategories(entry.meta),
  };
}

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
