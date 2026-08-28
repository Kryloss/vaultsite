/**
 * The parts of the music section that reach the BROWSER.
 *
 * `lib/music.ts` reads the vault, so it imports `fs` and can never be pulled
 * into a client bundle. The /music list became a client component when it
 * gained a search box and a language filter, so everything that component
 * needs — the shapes, the language model, the filter and the initials
 * fallback — lives here instead, with no filesystem behind it.
 *
 * Same split, and the same reason, as `lib/dates.ts` against `lib/vault.ts`.
 * `lib/music.ts` re-exports all of it, so server-side callers are unchanged.
 */
import type { Str } from "@/lib/ui-strings";

/** The languages the ENG/UA/RU filter offers, in the order it shows them. */
export const MUSIC_LANGS = ["en", "uk", "ru"] as const;
export type MusicLang = (typeof MUSIC_LANGS)[number];

/**
 * `lang:` on a note → the language(s) it is SUNG in.
 *
 * A LIST, not a string, because a song can be two: PRAY is an English verse
 * with a Ukrainian chorus, and picking one of those would be a false answer to
 * the question the filter asks. A note that names none is matched by "All" and
 * by nothing else — silence is not a language, and guessing one from the
 * artist would be wrong the first time an artist switched.
 *
 * Values outside MUSIC_LANGS are dropped rather than kept: an unknown code
 * cannot be selected in the UI, so keeping it would make a note that no filter
 * can reach and no filter can explain.
 */
export function noteLangs(meta: Record<string, unknown>): MusicLang[] {
  const raw = meta.lang ?? meta.langs;
  const list = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  const out: MusicLang[] = [];
  for (const v of list) {
    const s = String(v).trim().toLowerCase();
    const hit = MUSIC_LANGS.find((l) => l === s);
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out;
}

export interface MusicArtist {
  name: string;
  nameUk?: string;
  /**
   * The People note about this artist, when one exists — their name and
   * portrait become links to it. Undefined otherwise, and nothing on the card
   * changes: an artist nobody has written a profile of is the normal case.
   */
  href?: string;
  /** The artist in general — NOT this release. See DECISIONS #103. */
  bio?: string;
  bioUk?: string;
  photoUrl?: string;
  photoBlur?: string;
  photoSrcSet?: string;
}

export interface MusicNote {
  slug: string;
  title: string;
  titleUk?: string;
  description?: string;
  /** Ukrainian description from the entry's `description_uk:` frontmatter. */
  descriptionUk?: string;
  date?: string;
  format: Str;
  /** From `lang:` — what the ENG/UA/RU filter matches on. May be empty. */
  langs: MusicLang[];
  cover?: string;
  coverBlur?: string;
  coverSrcSet?: string;
}

export interface ArtistGroup {
  /** Stable key for React, and what notes are matched on. */
  key: string;
  /** Undefined for notes that name no artist — they still get listed. */
  artist?: MusicArtist;
  notes: MusicNote[];
  /** The newest note's date; what the groups are ordered by. */
  updated: string;
  /** The newest note's cover — the card's tint. */
  cover?: string;
}

/** Case- and spacing-insensitive, like `series:` matching. */
export function artistKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Lowercased words, across scripts. `\p{L}` with the `u` flag is what makes
 * Cyrillic split like Latin does — `\w` would treat "Вороны" as punctuation and
 * throw the whole title away.
 */
function words(s: string): string[] {
  return s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/**
 * The words one row answers a search on: the note in both languages, and the
 * artist it hangs under.
 *
 * The ARTIST is folded into every one of their rows on purpose. The page is
 * grouped by artist, so typing "Noize" has to keep that card whole rather than
 * matching the heading and emptying the list under it — and a card whose head
 * matched but whose rows all vanished would read as a bug, not as a filter.
 *
 * `format` is in here too, which is what makes "ep", "single" and "album" work
 * as queries: they are the only place those words exist as data.
 */
function noteWords(note: MusicNote, artist?: MusicArtist): string[] {
  return words(
    [
      note.title,
      note.titleUk,
      note.description,
      note.descriptionUk,
      note.format.en,
      note.format.uk,
      artist?.name,
      artist?.nameUk,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

/**
 * Every term has to PREFIX a word — not merely appear somewhere in the text.
 *
 * A plain substring search was the first version and it fails the query the
 * box was asked for: "ep" is a format, and it also sits inside "Stepan" and
 * "Independence", so searching for EPs returned four cards of which one was an
 * EP. Prefixes keep the useful half of substring matching — "noiz" still finds
 * Noize MC while you are still typing — and drop the half that finds a word's
 * middle, which nobody is ever looking for.
 *
 * All terms must match, so a second word narrows rather than widens.
 */
function matchesQuery(haystack: string[], terms: string[]): boolean {
  return terms.every((t) => haystack.some((w) => w.startsWith(t)));
}

/**
 * The /music list narrowed by the search box and the language switch.
 *
 * Both filters apply to NOTES; a card survives only if something under it did.
 * An artist whose every row was filtered out is not a result — the card is a
 * heading for its rows, and a heading over nothing is noise in a list you are
 * scanning.
 *
 * Pure and given its groups rather than reading them, so `npm test` covers it:
 * the interesting cases (a bilingual note, a note with no `lang:`, a query
 * that only the artist name matches) are ones the vault may not always have.
 */
export function filterGroups(
  groups: ArtistGroup[],
  opts: { query?: string; lang?: MusicLang | null }
): ArtistGroup[] {
  const terms = words(opts.query ?? "");
  const lang = opts.lang ?? null;
  /* A query of only punctuation has no terms, so it is not a filter — the same
     answer `"   "` gets, and the right one: nothing was asked. */
  if (terms.length === 0 && !lang) return groups;

  const out: ArtistGroup[] = [];
  for (const group of groups) {
    const notes = group.notes.filter((note) => {
      if (lang && !note.langs.includes(lang)) return false;
      if (terms.length > 0 && !matchesQuery(noteWords(note, group.artist), terms))
        return false;
      return true;
    });
    if (notes.length > 0) out.push({ ...group, notes });
  }
  return out;
}

/** "Twenty One Pilots" → "TP", for an artist with no portrait. */
export function artistInitials(name: string): string {
  const words = name.split("|")[0].trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}
