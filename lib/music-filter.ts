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
import { fold, similarity } from "@/lib/fuzzy";

/** The languages the ENG/UA/RU filter offers, in the order it shows them. */
export const MUSIC_LANGS = ["en", "uk", "ru"] as const;
export type MusicLang = (typeof MUSIC_LANGS)[number];

/**
 * `lang:` on a note → which shelf it belongs on. NOT strictly what it is sung
 * in, and the difference is the whole point (docs/DECISIONS.md #117).
 *
 * Нервы sing in Russian and are a Ukrainian band, so they are `uk`. Ляпис
 * Трубецкой are Belarusian, sing in Russian, and their frontman holds Ukrainian
 * residency and the Honoured Artist title — `uk`. BLIND8 and Tricky Nicki are
 * Ukrainian and write for an English-speaking listener, so they stay `en`.
 * Language is the strongest signal and it is not the only one; the owner
 * decides, and the key records the decision rather than deriving it.
 *
 * A LIST, not a string, because a record can sit on two shelves: PRAY is an
 * English verse with a Ukrainian chorus. A note naming none is matched by
 * "All" and by nothing else — an absent answer is not a third answer.
 *
 * Values outside MUSIC_LANGS are dropped: an unknown code cannot be selected in
 * the UI, so keeping it would make a note no filter can reach or explain.
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

/**
 * `genres:` on a note → Apple's own `primaryGenreName`, split on the slash.
 *
 * Derived rather than invented: "Hip-Hop/Rap" becomes Rap, "Pop Punk" becomes
 * Pop and Punk. Free-form on purpose — the chips are built from whatever the
 * vault actually contains, so adding a genre is adding it to one note.
 */
export function noteGenres(meta: Record<string, unknown>): string[] {
  const raw = meta.genres ?? meta.genre;
  const list = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  const out: string[] = [];
  for (const v of list) {
    const g = String(v).trim();
    if (g && !out.some((x) => x.toLowerCase() === g.toLowerCase())) out.push(g);
  }
  return out;
}

/**
 * Every genre the page holds — the union of its notes', deduped case-blind.
 *
 * Used to TAG artists at build time, not to draw anything: the genres are
 * search terms, never chips. See `artistTags()` in lib/music.ts.
 */
export function collectGenres(notes: { genres: string[] }[]): string[] {
  const out: string[] = [];
  for (const n of notes)
    for (const genre of n.genres)
      if (!out.some((x) => x.toLowerCase() === genre.toLowerCase())) out.push(genre);
  return out.sort((a, b) => a.localeCompare(b));
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
  /**
   * Hidden search terms for this artist — never rendered, only matched.
   *
   * Derived at build time as the union of their notes' `genres:`, plus
   * anything hand-written under `tags:` on the artist in main.md. It is what
   * makes "rap" return rap ARTISTS rather than only the individual rows whose
   * own release Apple happened to file under Rap. See DECISIONS #117.
   */
  tags?: string[];
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
  /** From `genres:` — searchable, and the source of the genre chips. */
  genres: string[];
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
 * Folded, lowercased words. `fold()` strips Latin diacritics so "maneskin"
 * finds Måneskin; `\p{L}` with the `u` flag is what makes Cyrillic split like
 * Latin does — `\w` would treat "Вороны" as punctuation and drop the title.
 */
function words(s: string): string[] {
  return fold(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/**
 * The words one row answers a search on: the note in both languages, the
 * artist it hangs under, its format and its genres.
 *
 * The ARTIST is folded into every one of their rows on purpose. The page is
 * grouped by artist, so typing "Noize" has to keep that card whole rather than
 * matching the heading and emptying the list under it — a card whose head
 * matched but whose rows all vanished would read as a bug, not a filter.
 *
 * `format` and `genres` are here because they are the only place the words
 * "ep", "album", "rock" and "rap" exist as data.
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
      ...note.genres,
      ...(artist?.tags ?? []),
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
 * How close a mistyped query comes to a row, on the palette's own measure.
 *
 * Compared against the SHORT identifying strings only — title, artist, genre —
 * never the description. Trigram overlap divides by the longer string, so a
 * three-word query against a twenty-word sentence scores near zero no matter
 * how well it matches, and letting the description in would mean the fallback
 * silently never fires for the rows that have one.
 */
function nearness(note: MusicNote, artist: MusicArtist | undefined, q: string): number {
  const candidates = [
    note.title,
    note.titleUk,
    artist?.name,
    artist?.nameUk,
    ...note.genres,
    ...(artist?.tags ?? []),
  ].filter((v): v is string => Boolean(v));
  let best = 0;
  for (const c of candidates) best = Math.max(best, similarity(q, c));
  return best;
}

/** Same threshold the Cmd+K palette uses for its "did you mean" pass. */
const FUZZY_FLOOR = 0.2;

export interface MusicFilterResult {
  groups: ArtistGroup[];
  /** True when nothing matched literally and these are near-misses instead. */
  fuzzy: boolean;
}

/**
 * The /music list narrowed by the search box, the language switch and the
 * genre chips.
 *
 * Filters apply to NOTES; a card survives only if something under it did. An
 * artist whose every row was filtered out is not a result — the card is a
 * heading for its rows, and a heading over nothing is noise in a list you are
 * scanning.
 *
 * Search runs the palette's two passes (components/CommandPalette.tsx): a
 * literal one, and — only when that finds nothing — a trigram pass so a typo
 * still lands. `fuzzy` comes back true for the second, because results that
 * are approximately what you asked for have to say so.
 *
 * Language and genre are NOT fuzzy. They are chosen from a list rather than
 * typed, so there is no typo to forgive, and a near-miss on a filter you
 * clicked would just be wrong.
 *
 * Pure and given its groups rather than reading them, so `npm test` covers it.
 */
export function filterGroups(
  groups: ArtistGroup[],
  opts: { query?: string; lang?: MusicLang | null }
): MusicFilterResult {
  const terms = words(opts.query ?? "");
  const lang = opts.lang ?? null;
  /* A query of only punctuation has no terms, so it is not a filter — the same
     answer `"   "` gets, and the right one: nothing was asked. */
  if (terms.length === 0 && !lang) return { groups, fuzzy: false };

  const narrow = (keep: (n: MusicNote, a?: MusicArtist) => boolean) => {
    const out: ArtistGroup[] = [];
    for (const group of groups) {
      const notes = group.notes.filter((n) => {
        if (lang && !n.langs.includes(lang)) return false;
        return keep(n, group.artist);
      });
      if (notes.length > 0) out.push({ ...group, notes });
    }
    return out;
  };

  const literal = narrow((n, a) =>
    terms.length === 0 ? true : matchesQuery(noteWords(n, a), terms)
  );
  if (literal.length > 0 || terms.length === 0) return { groups: literal, fuzzy: false };

  /* Nothing matched literally — most often a typo. The whole query goes in as
     one string rather than term by term: trigrams are about the shape of what
     was typed, and splitting it first throws that shape away. */
  const q = (opts.query ?? "").trim();
  const near = narrow((n, a) => nearness(n, a, q) >= FUZZY_FLOOR);
  return { groups: near, fuzzy: near.length > 0 };
}

/** "Twenty One Pilots" → "TP", for an artist with no portrait. */
export function artistInitials(name: string): string {
  const words = name.split("|")[0].trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}
