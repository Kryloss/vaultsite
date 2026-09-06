/**
 * Studio pages: a shelf medium grouped by WHO MADE IT rather than by what
 * kind of thing it is (DECISIONS #139).
 *
 * The category pages answer "show me the strategy games"; this answers "show
 * me the rest of what these people made", which on a shelf of games is the
 * question you actually have after finishing one. It reuses the category
 * machinery whole — same URL segment, same chips, same statically rendered
 * page per value — so a studio page is a category page whose facet happens to
 * be the creator.
 *
 * GAMES ONLY, and that is one predicate exactly as `hasTopList()` is (#113).
 * A studio repeats on this shelf — three notes name 11 bit studios, three name
 * 4A Games, two each name CD Projekt Red, Hazelight, Blizzard and GSC — while
 * a director on the films row has one film and an author on the books row has
 * one book, so everywhere else this would generate a page per note with one
 * item on it and a chip that leads to a list of one. If that changes, add the
 * medium here rather than teaching a component the word "game".
 */
import { slugify, type Entry } from "./vault";
import {
  categorySlug,
  entryCreator,
  entryMedium,
  toShelfItem,
  type ShelfCreator,
  type ShelfItem,
} from "./shelf";

/** URL segment for the index of every studio, e.g. /shelf/type/games/studios. */
export const CREATORS_SLUG = "studios";

/**
 * Slugs the creator namespace may not use, because the same URL segment
 * already means something else there. `quotes` is books-only and `studios` is
 * this feature's own index, but both are listed for either medium: the cost of
 * being wrong is a page that silently shadows another, and the cost of being
 * cautious is that a studio called "Quotes" would go unlinked.
 */
const RESERVED = new Set([CREATORS_SLUG, "quotes"]);

const CREATOR_PAGE_MEDIUMS = new Set(["game"]);

/** Does this medium group its notes by creator as well as by category? */
export function hasCreatorPages(medium?: string): boolean {
  return Boolean(medium && CREATOR_PAGE_MEDIUMS.has(medium));
}

export interface ShelfCreatorGroup {
  /** URL segment: `slugify()` of the name, so "11 bit studios" → 11-bit-studios. */
  slug: string;
  /** The block the note page already shows, reused verbatim as the header. */
  creator: ShelfCreator;
  items: ShelfItem[];
}

/**
 * Every creator on a medium, with their work, alphabetical by name.
 *
 * The FIRST note to name a studio supplies the portrait and the bio, and a
 * later one only fills in what is still missing — so two notes describing the
 * same studio slightly differently produce one block rather than two, and the
 * page never has to pick between them. That is also why the vault can keep
 * writing the bio into every note: it is the note's own copy, and this is a
 * view over the notes, not a second place to maintain the fact.
 *
 * A creator whose slug collides with a category on the same medium, or with a
 * reserved segment, is DROPPED — not renamed. The category page already owns
 * that address, and inventing a suffix would put a URL on the site that
 * nothing in the vault spells. Dropping it is visible (the studio's name stops
 * being a link) rather than silent (a page that shadows another).
 */
export function shelfCreatorGroups(
  entries: Entry[],
  medium: string
): ShelfCreatorGroup[] {
  const taken = new Set(RESERVED);
  const bySlug = new Map<string, ShelfCreatorGroup>();

  for (const entry of entries) {
    if (entryMedium(entry) !== medium) continue;
    const item = toShelfItem(entry);
    for (const c of item.categories) taken.add(categorySlug(c));

    const creator = entryCreator(entry);
    if (!creator) continue;
    const slug = slugify(creator.name);
    if (!slug) continue;

    const existing = bySlug.get(slug);
    if (existing) {
      existing.items.push(item);
      // Fill the gaps only: whoever wrote it down first is who it is.
      existing.creator = {
        ...creator,
        ...existing.creator,
        photoUrl: existing.creator.photoUrl ?? creator.photoUrl,
        photoBlur: existing.creator.photoBlur ?? creator.photoBlur,
        photoSrcSet: existing.creator.photoSrcSet ?? creator.photoSrcSet,
        bio: existing.creator.bio ?? creator.bio,
        bioUk: existing.creator.bioUk ?? creator.bioUk,
        nameUk: existing.creator.nameUk ?? creator.nameUk,
      };
    } else {
      bySlug.set(slug, { slug, creator, items: [item] });
    }
  }

  return [...bySlug.values()]
    .filter((g) => !taken.has(g.slug))
    .sort((a, b) => a.creator.name.localeCompare(b.creator.name));
}

/** One studio's page, or undefined when the segment names something else. */
export function creatorGroupBySlug(
  entries: Entry[],
  medium: string,
  slug: string
): ShelfCreatorGroup | undefined {
  if (!hasCreatorPages(medium)) return undefined;
  return shelfCreatorGroups(entries, medium).find((g) => g.slug === slug);
}

/**
 * The path a note's own creator block links to, or undefined when there is no
 * page behind it — a medium without studio pages, a note naming nobody, or a
 * name whose slug was dropped above. Undefined means the block renders as
 * plain text, which is what it did before this existed.
 */
export function creatorHref(
  entries: Entry[],
  entry: Entry,
  sectionSlug: string,
  mediumUrlSlug: string
): string | undefined {
  const medium = entryMedium(entry);
  if (!hasCreatorPages(medium)) return undefined;
  const creator = entryCreator(entry);
  if (!creator) return undefined;
  const slug = slugify(creator.name);
  const group = shelfCreatorGroups(entries, medium!).find((g) => g.slug === slug);
  if (!group) return undefined;
  return `/${sectionSlug}/type/${mediumUrlSlug}/${group.slug}`;
}

/**
 * The studio index's order: MOST OF THIS SHELF FIRST (DECISIONS #142).
 *
 * `shelfCreatorGroups` stays alphabetical because that is what the chip row
 * wants — you scan a row of names for one you already know. A ranked list is
 * a different question, so it gets a different sort rather than a second
 * meaning bolted onto the first.
 *
 * The figure is how many of their games are on the shelf, and that is
 * deliberately a FACT rather than a verdict. A studio's own stars would have
 * to be an average or a best-of over Kyrylo's ratings of their games, and
 * both of those attribute to a studio an opinion he gave about one game —
 * #114's rule (two verdicts, never merged) pointed the other way, at IMDb,
 * but it is the same mistake: a number in his handwriting that he never
 * wrote. The count says what the row is ranked on and nothing more.
 *
 * Ties break on name, so the order is total and a rebuild never reshuffles
 * studios with the same number of games — which, on a shelf this size, is
 * most of them.
 */
export function sortCreatorsForTop(
  groups: ShelfCreatorGroup[]
): ShelfCreatorGroup[] {
  return [...groups].sort(
    (a, b) =>
      b.items.length - a.items.length ||
      a.creator.name.localeCompare(b.creator.name)
  );
}
