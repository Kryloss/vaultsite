/**
 * Which notes the entry footer's arrows walk.
 *
 * The shelf is the case worth pinning: it holds four mediums in ONE
 * date-ordered list, so before this the arrows on a book pointed at whatever
 * happened to be shelved either side of it. The vault exercises the happy path
 * on every build, but not the medium-less "unsorted" row, and nothing about a
 * green build would say the arrows had started crossing mediums again.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { siblingPool } from "./siblings.ts";
import type { Entry, Section } from "./vault.ts";

function section(fields: Partial<Section>): Section {
  return {
    slug: "shelf",
    dirName: "Shelf",
    title: "Shelf",
    order: 100,
    type: "shelf",
    content: "",
    ...fields,
  } as Section;
}

function entry(slug: string, folder?: string): Entry {
  return {
    slug,
    fileName: slug,
    sectionSlug: "shelf",
    sectionDir: "Shelf",
    title: slug,
    content: "",
    meta: {},
    draft: false,
    folder,
  } as Entry;
}

const shelf = [
  entry("fight-club", "Movies"),
  entry("death-note", "Shows"),
  entry("forrest-gump", "Movies"),
  entry("sapiens", "Books"),
  entry("loose-note"),
];

test("a shelf note's neighbours are its own medium", () => {
  const pool = siblingPool(section({}), shelf, shelf[0]);
  assert.deepEqual(
    pool.map((e) => e.slug),
    ["fight-club", "forrest-gump"]
  );
});

test("a note filed nowhere keeps company with the other unsorted notes", () => {
  const pool = siblingPool(section({}), shelf, shelf[4]);
  assert.deepEqual(
    pool.map((e) => e.slug),
    ["loose-note"]
  );
});

test("every other section walks its whole list", () => {
  const posts = section({ slug: "posts", type: "posts" });
  assert.equal(siblingPool(posts, shelf, shelf[0]).length, shelf.length);
});
