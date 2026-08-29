/**
 * Series — notes written as one arc, read in order.
 *
 * A note joins a series with one frontmatter key:
 *
 *   series: Security+ journey     # required — the name IS the identity
 *   series_uk: Шлях до Security+  # optional, written on any one part
 *   part: 2                       # optional, only when date order is wrong
 *
 * Matching is by name, case- and space-insensitive, so a typo makes a second
 * series rather than silently dropping a note — visible in the rendered list.
 *
 * The index is built VAULT-WIDE, not per section: wiki links already resolve
 * across sections, and an arc that starts as a post and ends as a project is
 * exactly the case a series is for. Nothing in the URL changes — a series is
 * a relationship between notes, not a place (same reasoning as subfolders,
 * DECISIONS #27), so there is no /series/<name> route to keep in sync.
 */
import type { Str } from "./ui-strings";
import {
  getEntries,
  getEntry,
  getSectionBySlug,
  getSections,
  type Entry,
  type Section,
} from "./vault";

/**
 * A part, ready to render — a number, a name and a link, and nothing else.
 *
 * No date: the popover is a place to go, not a thing to read, and the reading
 * order is already carried by the numbering. Dates only made each row wider
 * and gave the eye a second column to skip.
 */
export interface SeriesPart {
  href: string;
  title: string;
  titleUk?: string;
  /** 1-based position in the series. */
  number: number;
  /** True for the note currently being read. */
  current: boolean;
}

export interface Series {
  /** Display name, as written in the first part's frontmatter. */
  name: string;
  nameUk?: string;
  parts: SeriesPart[];
  /** 1-based position of the note being read. */
  index: number;
  /** parts.length, spelled out because every caller wants both numbers. */
  total: number;
  /**
   * "Part 2 of 5", both languages, built here rather than in the component.
   *
   * components/Series.tsx is a CLIENT component (the popover needs state) and
   * this module reaches the filesystem — so everything it needs at runtime is
   * computed on this object and the type is imported `import type`. Same
   * server-slims-the-rows split as PostList → PostListClient.
   */
  partLabel: Str;
}

/**
 * "Part 2 of 5", both languages.
 *
 * A pair rather than a `ui` key because it interpolates numbers, and `ui` is
 * a flat dictionary of fixed strings — same reason categoryLabel() lives in
 * lib/categories.ts.
 */
export function seriesPartLabel(index: number, total: number): Str {
  return {
    en: `Part ${index} of ${total}`,
    uk: `Частина ${index} з ${total}`,
  };
}

/** `series:` as written, trimmed. Anything not a non-empty string is "no series". */
export function seriesName(meta: Record<string, unknown>): string | undefined {
  const raw = meta.series;
  if (typeof raw !== "string") return undefined;
  const name = raw.trim();
  return name.length > 0 ? name : undefined;
}

/** "Security+  Journey " and "security+ journey" are the same series. */
function seriesKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

/** `part: 2` when it's a usable number, otherwise undefined. */
function partNumber(meta: Record<string, unknown>): number | undefined {
  const raw = meta.part;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

interface Member {
  section: Section;
  entry: Entry;
}

export interface SeriesOption {
  name: string;
  nameUk?: string;
}

/**
 * Reading order: `part:` when given, then oldest first, then by title.
 *
 * Date ascending is the point — a section's own list runs newest first, which
 * is right for browsing and backwards for a series, where part one is the
 * oldest note. `part:` exists for the case dates can't express: two notes
 * published the same day, or a part written out of order and backdated.
 * Notes without it sort after those with it, so numbering half a series
 * still puts those parts where you said.
 */
function byReadingOrder(a: Member, b: Member): number {
  const pa = partNumber(a.entry.meta) ?? Infinity;
  const pb = partNumber(b.entry.meta) ?? Infinity;
  if (pa !== pb) return pa - pb;

  // Undated notes sort last rather than to 1970.
  const da = a.entry.date ?? "9999-12-31";
  const db = b.entry.date ?? "9999-12-31";
  if (da !== db) return da < db ? -1 : 1;

  return a.entry.title.localeCompare(b.entry.title);
}

/**
 * Every series in the vault, keyed by normalised name.
 *
 * Rebuilt per call, like getWikiIndex() — the vault is small, and a cache
 * would go stale on every save in `next dev`, which is where content is
 * actually being written.
 */
function getSeriesIndex(): Map<string, Member[]> {
  const index = new Map<string, Member[]>();

  for (const section of getSections()) {
    // getEntries() already drops drafts in production, so a draft part is
    // invisible in the list without also renumbering the published ones —
    // it simply isn't a part yet.
    for (const entry of getEntries(section)) {
      const name = seriesName(entry.meta);
      if (!name) continue;
      const key = seriesKey(name);
      const members = index.get(key);
      if (members) members.push({ section, entry });
      else index.set(key, [{ section, entry }]);
    }
  }

  for (const members of index.values()) members.sort(byReadingOrder);
  return index;
}

/** Existing series names for the localhost entry-options picker. */
export function getSeriesOptions(): SeriesOption[] {
  return [...getSeriesIndex().values()]
    .map((members) => ({
      name: seriesName(members[0]?.entry.meta) ?? "",
      nameUk: members
        .map((member) => member.entry.meta.series_uk)
        .find((value): value is string => typeof value === "string" && value.trim().length > 0)
        ?.trim(),
    }))
    .filter((option) => option.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The series this note belongs to, or null.
 *
 * Null for a note with no `series:` AND for one whose series has a single
 * part — "Part 1 of 1" is a label with nothing to navigate to. It starts
 * rendering the moment a second part exists, which is the moment it means
 * something.
 */
export function getSeries(sectionSlug: string, entrySlug: string): Series | null {
  const section = getSectionBySlug(sectionSlug);
  const entry = getEntry(sectionSlug, entrySlug);
  if (!section || !entry) return null;

  const name = seriesName(entry.meta);
  if (!name) return null;

  const members = getSeriesIndex().get(seriesKey(name));
  if (!members || members.length < 2) return null;

  const i = members.findIndex(
    (m) => m.entry.slug === entrySlug && m.section.slug === sectionSlug
  );
  if (i === -1) return null;

  // The Ukrainian name is written once, on whichever part you happened to be
  // editing — repeating it on all five is five chances to disagree.
  const nameUk = members
    .map((m) => m.entry.meta.series_uk)
    .find((v): v is string => typeof v === "string" && v.trim().length > 0)
    ?.trim();

  return {
    name: seriesName(members[0].entry.meta) ?? name,
    nameUk,
    total: members.length,
    index: i + 1,
    partLabel: seriesPartLabel(i + 1, members.length),
    parts: members.map((m, n) => ({
      href: `/${m.section.slug}/${m.entry.slug}`,
      title: m.entry.title,
      titleUk: m.entry.titleUk,
      number: n + 1,
      current: n === i,
    })),
  };
}
