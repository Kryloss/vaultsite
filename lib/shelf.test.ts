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
  mediumSlug,
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
