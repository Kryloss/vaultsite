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
import { artistInitials, buildPersonIndex, entryFormat } from "./music.ts";
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
