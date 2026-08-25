/**
 * Shelf model — shared by the section page (Netflix-style rows) and the
 * per-medium pages at /<section>/type/<medium>.
 *
 * Everything here runs at build time; the shelf has no client-side state since
 * the medium rows replaced the old filter chips.
 */
import { parseCategories, slugify, type Entry, type Section } from "./vault";
import { resolveCoverUrl } from "./markdown";
import { blurFor, srcSetFor } from "./blur";
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
  /** Narrower WebP copies of the cover — see srcSetFor() in lib/blur.ts. */
  coverSrcSet?: string;
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
  /** `date:` frontmatter — read by components/NewBadge.tsx. */
  date?: string;
}

/**
 * The person (or channel) behind a shelf item, shown above the note's own
 * "At a glance" table on the entry page — see components/Creator.tsx.
 *
 * Everything but the name is optional and the block degrades a field at a
 * time: no photo falls back to initials, no bio leaves the name alone. That
 * matters because the sources are uneven — most novelists have a freely
 * licensed portrait on Wikimedia Commons and most YouTube channels do not,
 * and a note should never be blocked on one.
 */
export interface ShelfCreator {
  /** `author:` — the name exactly as the note writes it. */
  name: string;
  /** `author_uk:` — the name in Ukrainian, where transliterating it helps. */
  nameUk?: string;
  /**
   * What they are TO THIS WORK, chosen by medium rather than written per
   * note: the same person is an author on a book and a director on a film,
   * and the note already says which medium it is.
   */
  role: Str;
  /** `author_photo:` — resolved like `cover:`, so a bare file name is enough. */
  photoUrl?: string;
  /** Base64 blur-up placeholder for `photoUrl` — see lib/blur.ts. */
  photoBlur?: string;
  /** Narrower WebP copies — see srcSetFor() in lib/blur.ts. */
  photoSrcSet?: string;
  /** `author_bio:` / `author_bio_uk:` — one or two sentences, no more. */
  bio?: string;
  bioUk?: string;
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

/**
 * A note's medium: `medium:` frontmatter, or — when that's missing — the
 * subfolder it's filed in, so dropping a note into `vault/Shelf/Movies/` is
 * enough to make it a movie. Frontmatter always wins; a note at the section
 * root with no `medium:` still lands in the "unsorted" row as before.
 *
 * The one reader of `entry.folder` (lib/vault.ts) — everywhere else in the
 * codebase, folders are organizational only.
 */
export function entryMedium(entry: Entry): string | undefined {
  if (typeof entry.meta.medium === "string" && entry.meta.medium.trim())
    return entry.meta.medium.trim().toLowerCase();
  if (!entry.folder) return undefined;
  // "Books" → "book". Only the last path segment counts, and only for folder
  // names that name a medium — anything else is just a filing cabinet.
  const name = entry.folder.split("/").pop()!.toLowerCase();
  const singular = name.replace(/s$/, "");
  return MEDIUM_LABELS[singular] ? singular : undefined;
}

/**
 * Role label per medium. Deliberately not a `Record<string, Str>` lookup with
 * a shrug for anything missing: an unknown medium still has a human behind it,
 * so it falls back to "Author" rather than rendering an unlabelled name.
 */
const CREATOR_ROLES: Record<string, Str> = {
  book: ui.creatorAuthor,
  movie: ui.creatorDirector,
  show: ui.creatorShowCreator,
  video: ui.creatorChannel,
  youtube: ui.creatorChannel,
};

/**
 * The creator block's data, or undefined when the note names nobody.
 *
 * `author:` is the only required key — it already exists on every shelf note
 * and drives the card's byline — so adding the block to the site did not
 * make a single existing note invalid.
 */
export function entryCreator(entry: Entry): ShelfCreator | undefined {
  const str = (key: string) => {
    const v = entry.meta[key];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };

  /* Two keys name the same slot, and WHICH ONE the note used is what picks
     the role — so a music note needs no `medium:` and this function needs no
     knowledge of the section it's in. `artist:` says Artist; `author:` falls
     back to the medium the way it always has. Everything below the name
     follows the same prefix, so a note writes one family of keys, not two. */
  const key = str("artist") ? "artist" : "author";
  const name = str(key);
  if (!name) return undefined;

  const medium = entryMedium(entry);
  const photo = resolveCoverUrl(entry.sectionDir, entry.meta[`${key}_photo`]);

  return {
    name,
    nameUk: str(`${key}_uk`),
    role:
      key === "artist"
        ? ui.creatorArtist
        : (medium && CREATOR_ROLES[medium]) || ui.creatorAuthor,
    photoUrl: photo,
    photoBlur: blurFor(photo),
    photoSrcSet: srcSetFor(photo),
    bio: str(`${key}_bio`),
    bioUk: str(`${key}_bio_uk`),
  };
}

/**
 * "Yuval Noah Harari" → "YH", for a creator with no portrait to show.
 *
 * FIRST and LAST word, not the first two the People grid takes: a surname is
 * the half you recognise, so a middle name must not push it out. Anything
 * after a `|` is dropped first — a YouTube channel is often written
 * "Nate Herk | AI Automation", where the tagline after the pipe is not part of
 * the name and would otherwise supply the second letter.
 *
 * Lives here rather than inside components/Creator.tsx so `npm test` can reach
 * it. Every note in the vault currently has a photo, so this path renders
 * nowhere — which is exactly why it needs a test rather than a reader.
 */
export function creatorInitials(name: string): string {
  const words = name.split("|")[0].trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Frontmatter → the shape the cards render from. */
export function toShelfItem(entry: Entry): ShelfItem {
  const medium = entryMedium(entry);

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
    coverSrcSet: srcSetFor(cover),
    coverFit:
      entry.meta.coverFit === "contain" ? ("contain" as const) : undefined,
    rating:
      typeof entry.meta.rating === "number" ? entry.meta.rating : undefined,
    isVideo: medium === "video" || medium === "youtube" || Boolean(videoId),
    status,
    statusLabel,
    categories: parseCategories(entry.meta),
    date: entry.date,
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

/**
 * Does this section's notes open with a header block — a creator, then a
 * plain fact list — rather than going straight into the writing?
 *
 * ONE predicate for both, deliberately. The fact list is styled as plain rows
 * instead of a card BECAUSE the creator block sits above it and two framed
 * blocks stack badly (#87); they are two halves of one decision, and gating
 * them on separate conditions is how they would drift apart. Music joined
 * shelf here: an album has a maker and a handful of facts, which is the same
 * shape as a book.
 */
export function opensWithHeaderBlock(section: Section): boolean {
  return isShelfSection(section) || section.type === "music";
}
