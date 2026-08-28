/**
 * Shelf vocabulary: how a note's medium is decided and how the URLs are spelt.
 *
 * These are the functions that turn content into addresses, so a change here
 * silently breaks links that already exist in the wild — the kind of thing a
 * green build says nothing about.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  categorySlug,
  creatorInitials,
  entryMedium,
  hasTopList,
  mediumSlug,
  sortForTop,
  type ShelfItem,
} from "./shelf.ts";
import { slugify } from "./vault.ts";
import type { Entry } from "./vault.ts";

/** The smallest thing the shelf functions accept. */
function entry(fields: Partial<Entry>): Entry {
  return {
    slug: "x",
    fileName: "X",
    sectionSlug: "shelf",
    sectionDir: "Shelf",
    title: "X",
    content: "",
    meta: {},
    draft: false,
    ...fields,
  } as Entry;
}

test("frontmatter decides the medium", () => {
  assert.equal(entryMedium(entry({ meta: { medium: "movie" } })), "movie");
});

test("the subfolder decides when frontmatter doesn't", () => {
  assert.equal(entryMedium(entry({ folder: "Movies" })), "movie");
  assert.equal(entryMedium(entry({ folder: "Books" })), "book");
});

test("frontmatter wins over the subfolder", () => {
  const note = entry({ folder: "Books", meta: { medium: "video" } });
  assert.equal(entryMedium(note), "video");
});

test("a note filed nowhere in particular has no medium", () => {
  assert.equal(entryMedium(entry({})), undefined);
});

test("medium slugs are the plural URL segments", () => {
  assert.equal(mediumSlug("book"), "books");
  assert.equal(mediumSlug("movie"), "movies");
  assert.equal(mediumSlug("show"), "shows");
  assert.equal(mediumSlug("video"), "videos");
});

test("category slugs survive spaces and case", () => {
  assert.equal(categorySlug("Science Fiction"), "science-fiction");
  assert.equal(categorySlug("TECH"), "tech");
});

test("slugify is stable — changing it breaks every URL", () => {
  assert.equal(slugify("How was my day"), "how-was-my-day");
  assert.equal(slugify("Kyrylo’s notes"), "kyrylos-notes");
  assert.equal(slugify("Security+ journey"), "security-journey");
  assert.equal(slugify("  Trailing  spaces  "), "trailing-spaces");
});

/* The creator block's initials fallback (components/Creator.tsx). Nothing in
   the vault renders it — every shelf note has a portrait — so a regression
   here would ship invisibly and only show up the first time a creator has no
   photo. That is the case for a test rather than a screenshot. */

test("initials take the first and last word, not the first two", () => {
  assert.equal(creatorInitials("Yuval Noah Harari"), "YH");
  assert.equal(creatorInitials("Antoine de Saint-Exupéry"), "AS");
  assert.equal(creatorInitials("Kapranov Brothers"), "KB");
});

test("a channel's tagline after a pipe is not part of the name", () => {
  assert.equal(creatorInitials("Nate Herk | AI Automation"), "NH");
  assert.equal(creatorInitials("WVFRM Podcast"), "WP");
});

test("one word gives one letter, and nothing gives nothing", () => {
  assert.equal(creatorInitials("Waveform"), "W");
  assert.equal(creatorInitials("   "), "");
  assert.equal(creatorInitials(""), "");
});

test("initials are upper-cased and survive extra whitespace", () => {
  assert.equal(creatorInitials("  ernest   hemingway  "), "EH");
});

/*
 * The Top ordering (DECISIONS #113). Worth a test rather than a look: the
 * vault has almost no ratings today, so the branch the reader actually sees
 * is the unrated tail, and the rated branch would otherwise ship unexercised.
 */
function item(over: Partial<ShelfItem> & { slug: string }): ShelfItem {
  return { title: over.slug, categories: [], ...over };
}

test("sortForTop puts rated entries first, best down", () => {
  const out = sortForTop([
    item({ slug: "c", rating: 3 }),
    item({ slug: "a", rating: 5 }),
    item({ slug: "b", rating: 4.5 }),
  ]);
  assert.deepEqual(
    out.map((i) => i.slug),
    ["a", "b", "c"]
  );
});

test("sortForTop drops unrated entries below every rated one", () => {
  const out = sortForTop([
    item({ slug: "unrated", date: "2026-08-28" }),
    item({ slug: "rated-low", rating: 0.5, date: "2020-01-01" }),
  ]);
  assert.deepEqual(
    out.map((i) => i.slug),
    ["rated-low", "unrated"]
  );
});

test("sortForTop orders the unrated tail newest first", () => {
  const out = sortForTop([
    item({ slug: "old", date: "2024-01-01" }),
    item({ slug: "new", date: "2026-08-28" }),
    item({ slug: "mid", date: "2025-05-05" }),
  ]);
  assert.deepEqual(
    out.map((i) => i.slug),
    ["new", "mid", "old"]
  );
});

test("sortForTop breaks a full tie on title, so a rebuild never reshuffles", () => {
  const same = { rating: 4, date: "2026-08-28" };
  const out = sortForTop([
    item({ slug: "z", title: "Zodiac", ...same }),
    item({ slug: "a", title: "Amadeus", ...same }),
  ]);
  assert.deepEqual(
    out.map((i) => i.title),
    ["Amadeus", "Zodiac"]
  );
});

test("sortForTop does not mutate its input", () => {
  const input = [item({ slug: "a" }), item({ slug: "b", rating: 5 })];
  const copy = input.map((i) => i.slug);
  sortForTop(input);
  assert.deepEqual(
    input.map((i) => i.slug),
    copy
  );
});

test("hasTopList covers films and shows only", () => {
  assert.equal(hasTopList("movie"), true);
  assert.equal(hasTopList("show"), true);
  // Books keep the cover grid their spines row points at (#110); a channel
  // upload is not something you place in a top ten.
  assert.equal(hasTopList("book"), false);
  assert.equal(hasTopList("video"), false);
  assert.equal(hasTopList(undefined), false);
});

test("sortForTop orders the unrated tail by IMDb, best down", () => {
  const out = sortForTop([
    item({ slug: "mid", imdb: 8.2, date: "2026-08-28" }),
    item({ slug: "best", imdb: 9.5, date: "2026-08-28" }),
    item({ slug: "low", imdb: 7.1, date: "2026-08-28" }),
  ]);
  assert.deepEqual(
    out.map((i) => i.slug),
    ["best", "mid", "low"]
  );
});

test("his rating outranks a higher IMDb score — the list stays his shelf", () => {
  const out = sortForTop([
    item({ slug: "imdb-darling", imdb: 9.5 }),
    item({ slug: "his-pick", rating: 0.5, imdb: 4.0 }),
  ]);
  assert.deepEqual(
    out.map((i) => i.slug),
    ["his-pick", "imdb-darling"]
  );
});

test("sortForTop falls back to date when IMDb is missing too", () => {
  const out = sortForTop([
    item({ slug: "old", date: "2024-01-01" }),
    item({ slug: "new", date: "2026-08-28" }),
  ]);
  assert.deepEqual(
    out.map((i) => i.slug),
    ["new", "old"]
  );
});

test("an entry with an IMDb score sorts above one with none", () => {
  const out = sortForTop([
    item({ slug: "none", date: "2026-08-28" }),
    item({ slug: "scored", imdb: 6.0, date: "2020-01-01" }),
  ]);
  assert.deepEqual(
    out.map((i) => i.slug),
    ["scored", "none"]
  );
});
