/**
 * Studio pages (DECISIONS #139).
 *
 * The vault exercises the happy path and nothing else: every game names a
 * studio, and no studio's slug collides with a category. The collision rule
 * is the whole reason this file exists — it is invisible until the day
 * somebody files a game under a category named after a studio, and by then
 * the wrong page is already live at that address.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CREATORS_SLUG,
  creatorHref,
  hasCreatorPages,
  shelfCreatorGroups,
  sortCreatorsForTop,
} from "./shelf-creators.ts";
import type { Entry } from "./vault.ts";

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

/** A game note by `author`, filed under `categories`. */
function game(
  slug: string,
  author: string,
  extra: Record<string, unknown> = {}
): Entry {
  return entry({
    slug,
    title: slug,
    meta: { medium: "game", author, ...extra },
  });
}

test("only games group by creator", () => {
  assert.equal(hasCreatorPages("game"), true);
  // A director has one film and an author one book, so everywhere else this
  // would be a page per note and a chip leading to a list of one.
  assert.equal(hasCreatorPages("movie"), false);
  assert.equal(hasCreatorPages("show"), false);
  assert.equal(hasCreatorPages("book"), false);
  assert.equal(hasCreatorPages("video"), false);
  assert.equal(hasCreatorPages(undefined), false);
});

test("one studio, however many notes name it", () => {
  const groups = shelfCreatorGroups(
    [
      game("frostpunk", "11 bit studios"),
      game("the-alters", "11 bit studios"),
      game("cuphead", "Studio MDHR"),
    ],
    "game"
  );
  assert.deepEqual(
    groups.map((g) => [g.slug, g.items.length]),
    [
      // Alphabetical by name, so "11 bit studios" leads.
      ["11-bit-studios", 2],
      ["studio-mdhr", 1],
    ]
  );
});

test("notes of another medium are not in the games' studios", () => {
  const groups = shelfCreatorGroups(
    [
      game("frostpunk", "11 bit studios"),
      entry({ slug: "fight-club", meta: { medium: "movie", author: "David Fincher" } }),
    ],
    "game"
  );
  assert.deepEqual(
    groups.map((g) => g.slug),
    ["11-bit-studios"]
  );
});

test("the first note to name a studio describes it; later ones fill gaps", () => {
  const [group] = shelfCreatorGroups(
    [
      game("a", "Hazelight Studios", { author_bio: "First." }),
      game("b", "Hazelight Studios", {
        author_bio: "Second.",
        author_bio_uk: "Друге.",
      }),
    ],
    "game"
  );
  assert.equal(group.creator.bio, "First.");
  // Nothing said it in the first note, so the second one is allowed to.
  assert.equal(group.creator.bioUk, "Друге.");
});

test("a studio whose slug is already a category is dropped, not renamed", () => {
  const groups = shelfCreatorGroups(
    [
      // A studio actually called "Strategy", on a shelf that files games
      // under a Strategy category. The category page owns that address.
      game("a", "Strategy", { categories: ["Strategy"] }),
      game("b", "Larian Studios"),
    ],
    "game"
  );
  assert.deepEqual(
    groups.map((g) => g.slug),
    ["larian-studios"]
  );
});

test("the index's own segment, and books' quotes, are reserved too", () => {
  const groups = shelfCreatorGroups(
    [game("a", "Studios"), game("b", "Quotes"), game("c", "Valve")],
    "game"
  );
  assert.equal(CREATORS_SLUG, "studios");
  assert.deepEqual(
    groups.map((g) => g.slug),
    ["valve"]
  );
});

test("a note whose studio has no page gets no link", () => {
  const entries = [
    game("a", "Strategy", { categories: ["Strategy"] }),
    entry({ slug: "fight-club", meta: { medium: "movie", author: "David Fincher" } }),
    game("c", "Valve"),
  ];
  const href = (e: Entry) => creatorHref(entries, e, "shelf", "games");

  assert.equal(href(entries[2]), "/shelf/type/games/valve");
  // Dropped by the collision rule above — the name renders as plain text.
  assert.equal(href(entries[0]), undefined);
  // Films don't have studio pages at all.
  assert.equal(href(entries[1]), undefined);
  // Nobody named.
  assert.equal(href(game("d", "")), undefined);
});

test("the index ranks by how much of the shelf is theirs", () => {
  const groups = shelfCreatorGroups(
    [
      game("a", "Valve"),
      game("b", "11 bit studios"),
      game("c", "11 bit studios"),
      game("d", "Larian Studios"),
    ],
    "game"
  );
  // The chips stay alphabetical — a row of names is scanned, not read down.
  assert.deepEqual(
    groups.map((g) => g.creator.name),
    ["11 bit studios", "Larian Studios", "Valve"]
  );
  // The list is ranked, and ties break on name so a rebuild never reshuffles.
  assert.deepEqual(
    sortCreatorsForTop(groups).map((g) => g.creator.name),
    ["11 bit studios", "Larian Studios", "Valve"]
  );
  const two = shelfCreatorGroups(
    [game("a", "Zed Games"), game("b", "Zed Games"), game("c", "Ay Games")],
    "game"
  );
  assert.deepEqual(
    sortCreatorsForTop(two).map((g) => g.creator.name),
    ["Zed Games", "Ay Games"]
  );
});

test("sortCreatorsForTop does not mutate its input", () => {
  const groups = shelfCreatorGroups(
    [game("a", "Valve"), game("b", "11 bit studios"), game("c", "11 bit studios")],
    "game"
  );
  const before = groups.map((g) => g.slug);
  sortCreatorsForTop(groups);
  assert.deepEqual(
    groups.map((g) => g.slug),
    before
  );
});
