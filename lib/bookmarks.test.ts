/**
 * Run with `npm test`. Covers the pure half of bookmarks (lib/bookmarks.ts).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalise, parseSnapshot, toggled } from "./bookmarks.ts";

test("adds at the front, removes when already there", () => {
  assert.deepEqual(toggled([], "/posts/a"), ["/posts/a"]);
  assert.deepEqual(toggled(["/posts/a"], "/shelf/b"), ["/shelf/b", "/posts/a"]);
  assert.deepEqual(toggled(["/shelf/b", "/posts/a"], "/posts/a"), ["/shelf/b"]);
});

test("one page is one bookmark, whatever its query, hash or slash", () => {
  assert.equal(normalise("/posts/a/"), "/posts/a");
  assert.equal(normalise("/posts?category=Meta"), "/posts");
  assert.equal(normalise("/posts/a#why"), "/posts/a");
  assert.equal(normalise("/"), "/");
  assert.deepEqual(toggled(["/posts/a"], "/posts/a/#x"), []);
});

test("a corrupt snapshot reads as no bookmarks", () => {
  assert.deepEqual(parseSnapshot("not json"), []);
  assert.deepEqual(parseSnapshot('{"a":1}'), []);
  assert.deepEqual(parseSnapshot('["/a", 3, "/b"]'), ["/a", "/b"]);
});
