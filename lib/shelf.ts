/**
 * Shelf model — shared by the section page (Netflix-style rows) and the
 * per-medium pages at /<section>/type/<medium>.
 *
 * Everything here runs at build time; the shelf has no client-side state since
 * the medium rows replaced the old filter chips.
 */
import { parseCategories, slugify, type Entry, type Section } from "./vault";
import { resolveCoverUrl, resolveLangVariantUrl } from "./markdown";
import { blurFor, domFor, dimsFor, srcSetFor } from "./blur";
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
  /**
   * `author_uk:` — already written on every shelf note for the creator block.
   * Read by the book spines, where the byline sits directly beside a Cyrillic
   * title and a Latin name next to it reads as an untranslated page. The
   * cards don't use it yet; they set the author below their own title, where
   * it is far less conspicuous.
   */
  authorUk?: string;
  medium?: string;
  coverUrl?: string;
  /** Base64 blur-up placeholder for `coverUrl` — see lib/blur.ts. */
  coverBlur?: string;
  /** Narrower WebP copies of the cover — see srcSetFor() in lib/blur.ts. */
  coverSrcSet?: string;
  /**
   * The cover's dominant colour and its aspect ratio (h / w) — the two things
   * a book spine is built from on a medium page. Both come from the image
   * manifest, so a remote `cover: https://…` has neither and the spine falls
   * back. See lib/spine.ts and components/lists/BookSpines.tsx.
   */
  coverDom?: string;
  coverAr?: number;
  /**
   * `spine:` — a PHOTOGRAPH of the book's actual spine, which replaces the
   * generated one on the shelf. Optional and rare: it has to be sourced per
   * book, so most books keep the spine derived from their cover.
   *
   * `spineAr` (h / w) is what makes it worth having. The generated spine has
   * a uniform width because thickness would want a page count the vault has
   * not got — but a real spine photograph IS the thickness, measured rather
   * than invented, so a book with one stands at its true width.
   */
  spineUrl?: string;
  spineAr?: number;
  spineBlur?: string;
  /**
   * The `<name>.uk.<ext>` sibling of `spine:`, when the vault has one — the
   * same convention markdown embeds use, so no second frontmatter key.
   *
   * Worth having here in a way it would not be for a cover: the spine's words
   * are printed ON the artwork, so a Ukrainian edition is a different
   * photograph, not the same one relabelled. Width still comes from
   * `spineAr` — the English one — so the shelf does not shift when the reader
   * toggles language.
   */
  spineUkUrl?: string;
  spineUkBlur?: string;
  /**
   * The Ukrainian scan's OWN aspect ratio. Two photographs of the same book
   * rarely agree to better than a few percent, and forcing one width on both
   * makes `object-fit: cover` eat the difference — which on The Last Wish
   * meant the wolf at its foot. Each language gets its own exact width
   * instead; the book's apparent thickness then changes by a pixel or so
   * across the toggle, which is invisible, and nothing is ever cropped.
   */
  spineUkAr?: number;
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
  /**
   * `description:` — the note's one-line summary. The grid has no room for it
   * and never asked; the Top list (components/lists/ShelfTopList.tsx) is a
   * row of text and it is the line that makes a row worth reading.
   *
   * `descriptionUk` comes out of `entry.meta`, not off `Entry`, which models
   * no Ukrainian description — the same route the music list already takes.
   * Move it onto `Entry` if a third caller wants it.
   */
  description?: string;
  descriptionUk?: string;
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
  const coverDims = dimsFor(cover);
  // Resolved exactly like `cover:`, so a bare file name in the note is enough.
  const spine = resolveCoverUrl(entry.sectionDir, entry.meta.spine);
  const spineDims = dimsFor(spine);
  const spineUk = resolveLangVariantUrl(entry.sectionDir, entry.meta.spine);
  const spineUkDims = dimsFor(spineUk);

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
    authorUk:
      typeof entry.meta.author_uk === "string" ? entry.meta.author_uk : undefined,
    medium,
    coverUrl: cover ?? (videoId ? youtubeThumbnail(videoId) : undefined),
    // Only vault files have one; YouTube thumbnails are remote.
    coverBlur: blurFor(cover),
    coverSrcSet: srcSetFor(cover),
    coverDom: domFor(cover),
    coverAr: coverDims ? coverDims.h / coverDims.w : undefined,
    spineUrl: spine,
    spineAr: spineDims ? spineDims.h / spineDims.w : undefined,
    spineBlur: blurFor(spine),
    spineUkUrl: spineUk,
    spineUkBlur: blurFor(spineUk),
    spineUkAr: spineUkDims ? spineUkDims.h / spineUkDims.w : undefined,
    coverFit:
      entry.meta.coverFit === "contain" ? ("contain" as const) : undefined,
    rating:
      typeof entry.meta.rating === "number" ? entry.meta.rating : undefined,
    isVideo: medium === "video" || medium === "youtube" || Boolean(videoId),
    status,
    statusLabel,
    categories: parseCategories(entry.meta),
    date: entry.date,
    description: entry.description,
    descriptionUk:
      typeof entry.meta.description_uk === "string"
        ? entry.meta.description_uk
        : undefined,
  };
}

/*
 * No status rows. Reading state shows as a badge on the cover, in the medium
 * row the item already lives in — a separate "Up next" or "In progress" row
 * duplicated cards a few hundred pixels apart and made the shelf longer
 * without making anything easier to find. The rows are one medium each, and
 * they stay that way.
 */

/**
 * Mediums whose medium page leads with the ranked Top list instead of the
 * whole grid: films and shows, the two you actually rank against each other.
 *
 * Books are excluded because their medium page is the payoff for the section
 * page's spines — you came here to see the covers (DECISIONS #110) — and
 * videos because a channel upload is not something you place in a top ten.
 */
const TOP_MEDIUMS = new Set(["movie", "show"]);

/** Does this medium open on a Top list? See DECISIONS #113. */
export function hasTopList(medium?: string): boolean {
  return Boolean(medium && TOP_MEDIUMS.has(medium));
}

/**
 * The Top ordering: rated first, best down.
 *
 * Unrated entries do NOT interleave and do not get invented a score — a
 * rating is Kyrylo's and nothing else on the site guesses at one. They fall
 * to the end in date order, newest first, so the list stays a usable index of
 * everything while it fills in rather than hiding what he hasn't judged yet.
 * That matters right now: the shelf is 35 films and shows old and almost
 * none of them are rated, so a list of only the rated ones would be empty.
 *
 * Ties break on date and then title, so the order is total and a rebuild
 * never reshuffles equal entries.
 */
export function sortForTop(items: ShelfItem[]): ShelfItem[] {
  return [...items].sort((a, b) => {
    const ar = typeof a.rating === "number";
    const br = typeof b.rating === "number";
    if (ar !== br) return ar ? -1 : 1;
    if (ar && br && a.rating !== b.rating) return b.rating! - a.rating!;
    if (a.date !== b.date) return (b.date ?? "").localeCompare(a.date ?? "");
    return a.title.localeCompare(b.title);
  });
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
