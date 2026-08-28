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
  buildPersonIndex,
  entryFormat,
  filterGroups,
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
    ...fields,
  };
}

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
  assert.equal(filterGroups(groups, {}), groups);
  assert.equal(filterGroups(groups, { query: "   ", lang: null }), groups);
});

test("a language keeps only notes sung in it", () => {
  const groups = [
    group("a", [note({ slug: "uk1", langs: ["uk"] })], "A"),
    group("b", [note({ slug: "ru1", langs: ["ru"] })], "B"),
  ];
  const uk = filterGroups(groups, { lang: "uk" });
  assert.equal(uk.length, 1);
  assert.equal(uk[0].notes[0].slug, "uk1");
});

test("a bilingual note answers to BOTH of its languages", () => {
  const groups = [group("a", [note({ slug: "pray", langs: ["en", "uk"] })], "A")];
  assert.equal(filterGroups(groups, { lang: "en" })[0].notes.length, 1);
  assert.equal(filterGroups(groups, { lang: "uk" })[0].notes.length, 1);
  assert.equal(filterGroups(groups, { lang: "ru" }).length, 0);
});

test("a note with no lang: is reachable only through All", () => {
  const groups = [group("a", [note({ langs: [] })], "A")];
  assert.equal(filterGroups(groups, { lang: null }).length, 1);
  for (const l of ["en", "uk", "ru"] as const) {
    assert.equal(filterGroups(groups, { lang: l }).length, 0);
  }
});

test("an artist whose every row was filtered out is not a result", () => {
  const groups = [group("a", [note({ langs: ["ru"] })], "A")];
  assert.equal(filterGroups(groups, { lang: "uk" }).length, 0);
});

test("search matches the artist, so a matching card stays whole", () => {
  const groups = [
    group("noize mc", [note({ slug: "x", title: "Open Air" }), note({ slug: "y", title: "Vykhod" })], "Noize MC"),
    group("other", [note({ slug: "z", title: "Something" })], "Other"),
  ];
  const hit = filterGroups(groups, { query: "noize" });
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
  assert.equal(filterGroups(groups, { query: "ep" })[0].notes[0].slug, "ep");
  assert.equal(filterGroups(groups, { query: "quiet" })[0].notes[0].slug, "d");
  assert.equal(filterGroups(groups, { query: "нічого" }).length, 0);
});

test("a term PREFIXES a word — it is not found in the middle of one", () => {
  /* The case that forced this: "ep" is a format, and it also sits inside
     "Stepan" and "Independence". Substring matching returned both. */
  const groups = [
    group("a", [note({ slug: "ep", title: "Zed", format: ui.formatEp })], "A"),
    group("b", [note({ slug: "no", title: "Polaroid", description: "Stepan made it" })], "B"),
  ];
  const hit = filterGroups(groups, { query: "ep" });
  assert.equal(hit.length, 1);
  assert.equal(hit[0].notes[0].slug, "ep");
  /* Still a prefix search, so a half-typed word finds its row. */
  assert.equal(filterGroups(groups, { query: "pola" })[0].notes[0].slug, "no");
});

test("every term must match, so a second word narrows", () => {
  const groups = [
    group("a", [note({ slug: "keep", title: "Open Air" }), note({ slug: "drop", title: "Open Road" })], "A"),
  ];
  assert.equal(filterGroups(groups, { query: "open" })[0].notes.length, 2);
  const hit = filterGroups(groups, { query: "open air" });
  assert.equal(hit[0].notes.length, 1);
  assert.equal(hit[0].notes[0].slug, "keep");
});

test("a query of only punctuation is not a filter", () => {
  const groups = [group("a", [note({})], "A")];
  assert.equal(filterGroups(groups, { query: "—  ." }), groups);
});

test("search is case-insensitive across scripts", () => {
  const groups = [group("a", [note({ title: "Вороны" })], "Нервы")];
  assert.equal(filterGroups(groups, { query: "ВОРОН" }).length, 1);
  assert.equal(filterGroups(groups, { query: "нервы" }).length, 1);
});

test("the two filters compose", () => {
  const groups = [
    group("a", [note({ slug: "keep", title: "Open Air", langs: ["ru"] }),
                note({ slug: "drop", title: "Open Air", langs: ["uk"] })], "A"),
  ];
  const hit = filterGroups(groups, { query: "open", lang: "ru" });
  assert.equal(hit[0].notes.length, 1);
  assert.equal(hit[0].notes[0].slug, "keep");
});

test("filtering never mutates the groups it was given", () => {
  const groups = [group("a", [note({ langs: ["uk"] }), note({ langs: ["ru"] })], "A")];
  filterGroups(groups, { lang: "uk" });
  assert.equal(groups[0].notes.length, 2);
});
