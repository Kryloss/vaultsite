/**
 * Entry footer navigation — the notes either side of this one.
 *
 * Derived at build time from the ordering getEntries() already produces
 * (dates for posts, titles elsewhere), so there's nothing extra to maintain
 * in Obsidian.
 */
import { entryMedium, isShelfSection } from "./shelf";
import { getEntries, getSectionBySlug, type Entry, type Section } from "./vault";

export interface EntryRef {
  href: string;
  title: string;
  titleUk?: string;
}

function toRef(section: Section, entry: Entry): EntryRef {
  return {
    href: `/${section.slug}/${entry.slug}`,
    title: entry.title,
    titleUk: entry.titleUk,
  };
}

/**
 * The run of entries this note's arrows walk — the whole section, except on
 * the SHELF, where it is the note's own MEDIUM.
 *
 * The shelf keeps books, movies, shows and videos in one date-ordered list, so
 * a book's plain neighbours were whatever happened to be shelved either side
 * of it: Fight Club's "previous" was Death Note, and 11/22/63's "next" was
 * Arcane. Nothing on the site reads the shelf that way — the section page is
 * one row per medium and every medium has its own page — so the arrows walk
 * the row you are actually in.
 *
 * Notes with NO medium (the section root, which the section page shows as its
 * own unsorted row) are each other's neighbours, for the same reason: the pool
 * is the row, whichever row that is.
 */
export function siblingPool(
  section: Section,
  entries: Entry[],
  entry: Entry
): Entry[] {
  if (!isShelfSection(section)) return entries;
  const medium = entryMedium(entry);
  return entries.filter((e) => entryMedium(e) === medium);
}

/**
 * The entries before and after this one, in the section's own order.
 *
 * "Previous" means previous *in the list* — for posts, which sort newest
 * first, that's the newer note. Each arrow sits beside the neighbour's title,
 * so the direction reads correctly without spelling out newer/older.
 */
export function getSiblings(
  sectionSlug: string,
  entrySlug: string
): { prev?: EntryRef; next?: EntryRef } {
  const section = getSectionBySlug(sectionSlug);
  if (!section) return {};

  const entry = getEntries(section).find((e) => e.slug === entrySlug);
  if (!entry) return {};

  const entries = siblingPool(section, getEntries(section), entry);
  const i = entries.findIndex((e) => e.slug === entrySlug);
  if (i === -1) return {};

  return {
    prev: i > 0 ? toRef(section, entries[i - 1]) : undefined,
    next: i < entries.length - 1 ? toRef(section, entries[i + 1]) : undefined,
  };
}
