/**
 * Entry footer navigation — the notes either side of this one.
 *
 * Derived at build time from the ordering getEntries() already produces
 * (dates for posts, titles elsewhere), so there's nothing extra to maintain
 * in Obsidian.
 */
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

  const entries = getEntries(section);
  const i = entries.findIndex((e) => e.slug === entrySlug);
  if (i === -1) return {};

  return {
    prev: i > 0 ? toRef(section, entries[i - 1]) : undefined,
    next: i < entries.length - 1 ? toRef(section, entries[i + 1]) : undefined,
  };
}
