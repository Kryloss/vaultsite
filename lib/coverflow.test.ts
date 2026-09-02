/**
 * The deck's geometric hit test.
 *
 * Nothing in the vault exercises this: it is the fallback for an engine the
 * build never runs (WebKit cannot hit-test the raked cards — `lib/coverflow.ts`
 * and `docs/DECISIONS.md` #123), so a wrong answer here would reach a reader
 * on a phone before it reached anything else.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cardAtPoint, type CardBox } from "./coverflow.ts";

/** A card, positioned like the deck's: `z` is `100 - distance from centre`. */
function box(index: number, z: number, left: number, right: number): CardBox {
  return { index, z, left, top: 0, right, bottom: 100 };
}

test("finds the card under the point", () => {
  const deck = [box(0, 100, 0, 100), box(1, 99, 200, 300)];
  assert.equal(cardAtPoint(deck, 50, 50), 0);
  assert.equal(cardAtPoint(deck, 250, 50), 1);
});

test("misses count as no card, so a press on empty deck still drags", () => {
  const deck = [box(0, 100, 0, 100)];
  assert.equal(cardAtPoint(deck, 150, 50), null);
  assert.equal(cardAtPoint(deck, 50, 150), null);
  assert.equal(cardAtPoint([], 50, 50), null);
});

test("the frontmost of two overlapping covers wins, whatever order they are in", () => {
  /* A rake overlaps its cards; the one nearer the centre is painted on top,
     and that is the one the reader is pressing. */
  const behind = box(7, 93, 0, 100);
  const front = box(6, 94, 50, 150);
  assert.equal(cardAtPoint([behind, front], 75, 50), 6);
  assert.equal(cardAtPoint([front, behind], 75, 50), 6);
});

test("the edge of a cover belongs to it", () => {
  const deck = [box(0, 100, 10, 90)];
  assert.equal(cardAtPoint(deck, 10, 0), 0);
  assert.equal(cardAtPoint(deck, 90, 100), 0);
  assert.equal(cardAtPoint(deck, 9, 50), null);
});
