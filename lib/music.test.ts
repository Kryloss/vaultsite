/**
 * The music section's vocabulary: what a note is called, and who it belongs to.
 *
 * Two of these paths the vault cannot exercise today. No People note is about a
 * musician, so the artist → profile link renders nowhere; and no note writes
 * `format:`, so only the inferred branch is ever seen. Both are the kind of
 * thing that breaks quietly and is found by a reader rather than a build.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  artistInitials,
  collectGenres,
  buildPersonIndex,
  entryFormat,
  filterGroups,
  noteGenres,
  noteLangs,
} from "./music.ts";
import type { ArtistGroup, MusicNote } from "./music-filter.ts";
import { ui } from "./ui-strings.ts";
import type { Entry } from "./vault.ts";

/** The smallest thing these functions accept. */
function entry(fields: Partial<Entry>): Entry {
  return {
    slug: "x",
    fileName: "X",
    sectionSlug: "music",
    sectionDir: "Music",
    title: "X",
    content: "",
    meta: {},
    draft: false,
    ...fields,
  } as Entry;
}

test("format: wins when the note writes one", () => {
  assert.equal(entryFormat(entry({ meta: { format: "ep" } })), ui.formatEp);
  assert.equal(entryFormat(entry({ meta: { format: "EP" } })), ui.formatEp);
  assert.equal(
    entryFormat(entry({ meta: { format: " Single " } })),
    ui.formatSingle
  );
});

test("an unknown format falls through to the embedded link", () => {
  const note = entry({
    meta: { format: "cassette" },
    content: "https://music.apple.com/ca/album/x/1?i=2",
  });
  assert.equal(entryFormat(note), ui.formatTrack);
});

test("a track id in the link means Track, anything else Album", () => {
  assert.equal(
    entryFormat(entry({ content: "https://music.apple.com/ca/album/x/1?i=2" })),
    ui.formatTrack
  );
  assert.equal(
    entryFormat(entry({ content: "https://music.apple.com/ca/album/x/1" })),
    ui.formatAlbum
  );
});

test("only a link ALONE on its line is read", () => {
  /* The pipeline embeds standalone links, so anything mid-sentence is prose
     and must not decide what the note is called. */
  const note = entry({
    content: "I keep going back to https://music.apple.com/ca/album/x/1?i=2 lately",
  });
  assert.equal(entryFormat(note), ui.formatAlbum);
});

test("a note with no link at all is an Album", () => {
  assert.equal(entryFormat(entry({ content: "Just words." })), ui.formatAlbum);
});

test("a person is found by title, file name, slug or alias", () => {
  const index = buildPersonIndex("people", [
    entry({
      slug: "mykhailo-fedorov",
      fileName: "Mykhailo Fedorov",
      title: "Mykhailo Fedorov",
      titleUk: "Михайло Федоров",
      meta: { aliases: ["Fedorov", "Мінцифра"] },
    }),
  ]);
  const href = "/people/mykhailo-fedorov";
  assert.equal(index.get("mykhailo fedorov"), href);
  assert.equal(index.get("михайло федоров"), href);
  assert.equal(index.get("fedorov"), href);
  assert.equal(index.get("мінцифра"), href);
  assert.equal(index.get("someone else"), undefined);
});

test("matching an artist ignores case and spacing", () => {
  const index = buildPersonIndex("people", [
    entry({ slug: "maneskin", fileName: "Maneskin", title: "Måneskin" }),
  ]);
  assert.equal(index.get("måneskin"), "/people/maneskin");
  /* What `groupByArtist` normalises a note's `artist:` to before looking it
     up — a stray double space must not lose the profile. */
  assert.equal(
    index.get("Måneskin  ".trim().toLowerCase().replace(/\s+/g, " ")),
    "/people/maneskin"
  );
});

test("an entry with no aliases still indexes its own names", () => {
  const index = buildPersonIndex("people", [
    entry({ slug: "a", fileName: "A Person", title: "A Person" }),
  ]);
  assert.equal(index.get("a person"), "/people/a");
  assert.equal(index.size, 2);
});

test("initials take the first and LAST word", () => {
  assert.equal(artistInitials("Twenty One Pilots"), "TP");
  assert.equal(artistInitials("Måneskin"), "M");
  assert.equal(artistInitials("Nate Herk | AI Automation"), "NH");
  assert.equal(artistInitials("   "), "");
});

/* ---------- The language filter and the search box (lib/music-filter.ts) ----------
   Both are exercised here rather than through the page, because the cases that
   matter are ones the vault may stop having: a bilingual note, a note with no
   `lang:` at all, and a query that only the ARTIST name matches. */

function note(fields: Partial<MusicNote>): MusicNote {
  return {
    slug: "n",
    title: "A Track",
    format: ui.formatTrack,
    langs: [],
    genres: [],
    ...fields,
  };
}

/** The groups half of the result — what every assertion below is about. */
const filt = (
  groups: ArtistGroup[],
  opts: Parameters<typeof filterGroups>[1]
) => filterGroups(groups, opts).groups;

function group(key: string, notes: MusicNote[], artist?: string): ArtistGroup {
  return {
    key,
    artist: artist ? { name: artist } : undefined,
    notes,
    updated: "2026-01-01",
  };
}

test("noteLangs takes a string, a list, or nothing", () => {
  assert.deepEqual(noteLangs({ lang: "uk" }), ["uk"]);
  assert.deepEqual(noteLangs({ lang: ["en", "uk"] }), ["en", "uk"]);
  assert.deepEqual(noteLangs({}), []);
  /* Case and padding are the frontmatter's business, not the filter's. */
  assert.deepEqual(noteLangs({ lang: " RU " }), ["ru"]);
  /* A code no chip can select is dropped: keeping it would make a note that
     nothing in the UI can reach and nothing can explain. */
  assert.deepEqual(noteLangs({ lang: ["pl", "uk"] }), ["uk"]);
  assert.deepEqual(noteLangs({ lang: ["uk", "uk"] }), ["uk"]);
});

test("no query and no language returns the list untouched", () => {
  const groups = [group("a", [note({})], "Someone")];
  assert.equal(filt(groups, {}), groups);
  assert.equal(filt(groups, { query: "   ", lang: null }), groups);
  assert.equal(filterGroups(groups, {}).fuzzy, false);
});

test("a language keeps only notes sung in it", () => {
  const groups = [
    group("a", [note({ slug: "uk1", langs: ["uk"] })], "A"),
    group("b", [note({ slug: "ru1", langs: ["ru"] })], "B"),
  ];
  const uk = filt(groups, { lang: "uk" });
  assert.equal(uk.length, 1);
  assert.equal(uk[0].notes[0].slug, "uk1");
});

test("a bilingual note answers to BOTH of its languages", () => {
  const groups = [group("a", [note({ slug: "pray", langs: ["en", "uk"] })], "A")];
  assert.equal(filt(groups, { lang: "en" })[0].notes.length, 1);
  assert.equal(filt(groups, { lang: "uk" })[0].notes.length, 1);
  assert.equal(filt(groups, { lang: "ru" }).length, 0);
});

test("a note with no lang: is reachable only through All", () => {
  const groups = [group("a", [note({ langs: [] })], "A")];
  assert.equal(filt(groups, { lang: null }).length, 1);
  for (const l of ["en", "uk", "ru"] as const) {
    assert.equal(filt(groups, { lang: l }).length, 0);
  }
});

test("an artist whose every row was filtered out is not a result", () => {
  const groups = [group("a", [note({ langs: ["ru"] })], "A")];
  assert.equal(filt(groups, { lang: "uk" }).length, 0);
});

test("search matches the artist, so a matching card stays whole", () => {
  const groups = [
    group("noize mc", [note({ slug: "x", title: "Open Air" }), note({ slug: "y", title: "Vykhod" })], "Noize MC"),
    group("other", [note({ slug: "z", title: "Something" })], "Other"),
  ];
  const hit = filt(groups, { query: "noize" });
  assert.equal(hit.length, 1);
  /* Both rows survive: the query matched the artist, and a card whose head
     matched but whose rows all vanished would read as a bug. */
  assert.equal(hit[0].notes.length, 2);
});

test("search matches titles, descriptions and the format label", () => {
  const groups = [
    group("a", [note({ slug: "ep", title: "Zed", format: ui.formatEp })], "A"),
    group("b", [note({ slug: "d", title: "Yon", description: "a quiet one" })], "B"),
  ];
  assert.equal(filt(groups, { query: "ep" })[0].notes[0].slug, "ep");
  assert.equal(filt(groups, { query: "quiet" })[0].notes[0].slug, "d");
  assert.equal(filt(groups, { query: "нічого" }).length, 0);
});

test("a term PREFIXES a word — it is not found in the middle of one", () => {
  /* The case that forced this: "ep" is a format, and it also sits inside
     "Stepan" and "Independence". Substring matching returned both. */
  const groups = [
    group("a", [note({ slug: "ep", title: "Zed", format: ui.formatEp })], "A"),
    group("b", [note({ slug: "no", title: "Polaroid", description: "Stepan made it" })], "B"),
  ];
  const hit = filt(groups, { query: "ep" });
  assert.equal(hit.length, 1);
  assert.equal(hit[0].notes[0].slug, "ep");
  /* Still a prefix search, so a half-typed word finds its row. */
  assert.equal(filt(groups, { query: "pola" })[0].notes[0].slug, "no");
});

test("every term must match, so a second word narrows", () => {
  const groups = [
    group("a", [note({ slug: "keep", title: "Open Air" }), note({ slug: "drop", title: "Open Road" })], "A"),
  ];
  assert.equal(filt(groups, { query: "open" })[0].notes.length, 2);
  const hit = filt(groups, { query: "open air" });
  assert.equal(hit[0].notes.length, 1);
  assert.equal(hit[0].notes[0].slug, "keep");
});

test("a query of only punctuation is not a filter", () => {
  const groups = [group("a", [note({})], "A")];
  assert.equal(filt(groups, { query: "—  ." }), groups);
});

test("search is case-insensitive across scripts", () => {
  const groups = [group("a", [note({ title: "Вороны" })], "Нервы")];
  assert.equal(filt(groups, { query: "ВОРОН" }).length, 1);
  assert.equal(filt(groups, { query: "нервы" }).length, 1);
});

test("the two filters compose", () => {
  const groups = [
    group("a", [note({ slug: "keep", title: "Open Air", langs: ["ru"] }),
                note({ slug: "drop", title: "Open Air", langs: ["uk"] })], "A"),
  ];
  const hit = filt(groups, { query: "open", lang: "ru" });
  assert.equal(hit[0].notes.length, 1);
  assert.equal(hit[0].notes[0].slug, "keep");
});

test("filtering never mutates the groups it was given", () => {
  const groups = [group("a", [note({ langs: ["uk"] }), note({ langs: ["ru"] })], "A")];
  filt(groups, { lang: "uk" });
  assert.equal(groups[0].notes.length, 2);
});


/* ---------- Genres, folding, and the typo pass ---------- */

test("noteGenres takes a string or a list and de-duplicates", () => {
  assert.deepEqual(noteGenres({ genres: ["Rock", "Rap"] }), ["Rock", "Rap"]);
  assert.deepEqual(noteGenres({ genre: "Pop" }), ["Pop"]);
  assert.deepEqual(noteGenres({ genres: ["Rock", "rock"] }), ["Rock"]);
  assert.deepEqual(noteGenres({}), []);
});

test("collectGenres unions a group's notes, sorted and deduped", () => {
  assert.deepEqual(
    collectGenres([note({ genres: ["Rap", "Alternative"] }), note({ genres: ["rap", "Rock"] })]),
    ["Alternative", "Rap", "Rock"]
  );
});

test("an artist's hidden tags answer a search, so 'rap' returns rap ARTISTS", () => {
  /* The note itself is filed under Rock; the ARTIST is tagged Rap because
     another of their releases is. Searching "rap" has to return this card —
     that is the whole reason the tags exist. */
  const groups = [
    { ...group("a", [note({ slug: "rocky", genres: ["Rock"] })], "A"),
      artist: { name: "A", tags: ["Rap"] } },
    group("b", [note({ slug: "other", genres: ["Pop"] })], "B"),
  ];
  const hit = filt(groups, { query: "rap" });
  assert.equal(hit.length, 1);
  assert.equal(hit[0].notes[0].slug, "rocky");
});

test("genre is searchable as text too, so typing 'rock' works", () => {
  const groups = [group("a", [note({ genres: ["Rock"] })], "A")];
  assert.equal(filt(groups, { query: "rock" }).length, 1);
});

test("search folds accents, so 'maneskin' finds Måneskin", () => {
  const groups = [group("a", [note({ title: "GASOLINE" })], "Måneskin")];
  assert.equal(filt(groups, { query: "maneskin" }).length, 1);
  assert.equal(filt(groups, { query: "Måneskin" }).length, 1);
});

test("a typo falls back to the trigram pass and says so", () => {
  const groups = [group("a", [note({ title: "Bulletproof" })], "BLIND8")];
  /* Nothing prefixes "bulletpoof", so the literal pass is empty and the
     palette's fallback answers instead — flagged, because these are near
     misses rather than matches. */
  const res = filterGroups(groups, { query: "bulletpoof" });
  assert.equal(res.groups.length, 1);
  assert.equal(res.fuzzy, true);
});

test("a literal hit never reports itself as fuzzy", () => {
  const groups = [group("a", [note({ title: "Bulletproof" })], "BLIND8")];
  const res = filterGroups(groups, { query: "bullet" });
  assert.equal(res.groups.length, 1);
  assert.equal(res.fuzzy, false);
});

test("nonsense matches nothing, fuzzily or otherwise", () => {
  const groups = [group("a", [note({ title: "Bulletproof" })], "BLIND8")];
  const res = filterGroups(groups, { query: "qqqqzzzz" });
  assert.equal(res.groups.length, 0);
  assert.equal(res.fuzzy, false);
});

test("language is never fuzzy — it is pressed, not typed", () => {
  const groups = [group("a", [note({ langs: ["uk"], genres: ["Rock"] })], "A")];
  assert.equal(filt(groups, { lang: "ru" }).length, 0);
});

test("query and language compose", () => {
  const groups = [
    group("a", [
      note({ slug: "keep", title: "Open Air", langs: ["ru"] }),
      note({ slug: "wrongLang", title: "Open Air", langs: ["uk"] }),
      note({ slug: "wrongTitle", title: "Closed Road", langs: ["ru"] }),
    ], "A"),
  ];
  const hit = filt(groups, { query: "open", lang: "ru" });
  assert.equal(hit[0].notes.length, 1);
  assert.equal(hit[0].notes[0].slug, "keep");
});
