/**
 * Run with `npm test` — Node's own test runner, no dependencies to install.
 *
 * Covers the table of contents' scroll-spy (lib/toc-spy.ts). Like the reading
 * bar, this is behaviour you can't check by looking at a built page: it shows
 * up as a rail that highlights the wrong row, and the case it exists for —
 * short closing sections on a tall window — needs a specific viewport to
 * reproduce at all.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { READING_LINE, activeHeading, readingLine } from "./toc-spy.ts";

/** A page twice a tall window, with room left to scroll. */
const mid = { scrollY: 0, innerHeight: 900, scrollHeight: 3000 };

test("the line rests below the chrome while there's page left", () => {
  assert.equal(readingLine(mid), READING_LINE);
  // A full window's worth of scroll left is still "not the end".
  assert.equal(readingLine({ ...mid, scrollY: 3000 - 900 - 900 }), READING_LINE);
});

test("the line descends over the final screenful, reaching the foot at the end", () => {
  const max = 3000 - 900;
  assert.equal(readingLine({ ...mid, scrollY: max }), 900);
  assert.equal(readingLine({ ...mid, scrollY: max - 300 }), 600);
  // It descends at exactly the rate the page runs out: 700px of scroll left
  // puts the line 700px up from the foot of the window.
  assert.equal(readingLine({ ...mid, scrollY: max - 700 }), 200);
});

test("overscrolling past the end doesn't push the line off the window", () => {
  assert.equal(readingLine({ ...mid, scrollY: 3000 }), 900);
});

test("a page too short to scroll keeps the resting line", () => {
  const short = { scrollY: 0, innerHeight: 900, scrollHeight: 600 };
  assert.equal(readingLine(short), READING_LINE);
  // …so arriving at a short page highlights nothing, not its last heading.
  assert.equal(activeHeading([200, 400, 500], short), -1);
});

test("the last heading above the line wins", () => {
  // Two headings passed, one still below.
  assert.equal(activeHeading([-500, 100, 600], mid), 1);
  assert.equal(activeHeading([600, 800], mid), -1);
});

test("short closing sections each get their turn at the bottom", () => {
  const max = 3000 - 900;
  // Three headings packed into the last 200px of a 900px window: none of them
  // can ever reach 140px from the top, which is the bug this file exists for.
  const tail = [-1200, 700, 780, 860];
  // 300px from the end the line is at 600 — none of the three has had its
  // turn yet, and the section above them all is still the answer.
  assert.equal(activeHeading(tail, { ...mid, scrollY: max - 300 }), 0);
  assert.equal(activeHeading(tail, { ...mid, scrollY: max - 180 }), 1);
  assert.equal(activeHeading(tail, { ...mid, scrollY: max - 100 }), 2);
  assert.equal(activeHeading(tail, { ...mid, scrollY: max }), 3);
});
