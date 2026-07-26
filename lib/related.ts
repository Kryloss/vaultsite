/**
 * Entry footer navigation — the siblings either side of a note, and the notes
 * nearest to it by subject.
 *
 * Both are derived at build time from data the vault already carries: the
 * section's own ordering (dates for posts, titles elsewhere — see getEntries)
 * and `categories:` frontmatter. Nothing new to maintain in Obsidian.
 */
import {
  getEntries,
  getSectionBySlug,
  parseCategories,
  type Entry,
  type Section,
} from "./vault";

export interface EntryRef {
  href: string;
  title: string;
  titleUk?: string;
  /** Shared with the current entry — shown as context on related cards. */
  categories?: string[];
}

/** Default number of related notes to surface. */
const RELATED_LIMIT = 3;

function toRef(section: Section, entry: Entry, categories?: string[]): EntryRef {
  return {
    href: `/${section.slug}/${entry.slug}`,
    title: entry.title,
    titleUk: entry.titleUk,
    categories,
  };
}

/**
 * The entries before and after this one, in the section's own order.
 *
 * "Previous" means previous *in the list* — for posts, which sort newest
 * first, that's the newer note. Both labels sit next to the entry's title, so
 * the direction reads correctly without spelling out newer/older.
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

/**
 * Notes sharing at least one category with this one, best match first.
 *
 * Ranked by how many categories overlap, then by the section's existing order
 * so the newer of two equal matches wins. Scoped to the same section on
 * purpose: a book and a blog post sharing the tag "Tech" aren't meaningfully
 * related, and `[[wiki links]]` already carry the connections that are.
 */
export function getRelated(
  sectionSlug: string,
  entrySlug: string,
  limit = RELATED_LIMIT
): EntryRef[] {
  const section = getSectionBySlug(sectionSlug);
  if (!section) return [];

  const entries = getEntries(section);
  const current = entries.find((e) => e.slug === entrySlug);
  if (!current) return [];

  const mine = parseCategories(current.meta);
  if (mine.length === 0) return [];

  const scored: { ref: EntryRef; score: number; order: number }[] = [];
  entries.forEach((entry, order) => {
    if (entry.slug === entrySlug) return;
    const shared = parseCategories(entry.meta).filter((c) => mine.includes(c));
    if (shared.length === 0) return;
    scored.push({ ref: toRef(section, entry, shared), score: shared.length, order });
  });

  return scored
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((s) => s.ref);
}
