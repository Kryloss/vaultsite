/**
 * Run with `npm test` — Node's own test runner, no dependencies to install.
 *
 * Covers the sidebar note constellation (lib/constellation.ts). Calendar code
 * earns its tests: this runs at build time on a machine in some timezone,
 * against dates typed by hand into frontmatter, and the failure mode is a note
 * one column out — which looks entirely fine unless you already know which
 * week it belonged to.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_FILL,
  WEEKS,
  buildConstellation,
  dayKey,
  fillFor,
  parseDay,
  weekStart,
  type ConstellationNote,
} from "./constellation.ts";

const note = (date: string, title = "A note"): ConstellationNote => ({
  date,
  title,
  href: `/posts/${title.toLowerCase().replace(/\s+/g, "-")}`,
});

// 2026-08-13 is a Thursday; its week starts Monday 2026-08-10.
const TODAY = "2026-08-13";

test("weeks start on Monday", () => {
  assert.equal(dayKey(weekStart(parseDay("2026-08-13"))), "2026-08-10"); // Thu
  assert.equal(dayKey(weekStart(parseDay("2026-08-10"))), "2026-08-10"); // Mon
  // Sunday closes the week it's in; it does not open the next one.
  assert.equal(dayKey(weekStart(parseDay("2026-08-16"))), "2026-08-10");
});

test("the window is WEEKS columns ending with this week", () => {
  const c = buildConstellation([], TODAY);
  assert.equal(c.weeks.length, WEEKS);
  assert.equal(c.weeks.at(-1)!.start, "2026-08-10");
  assert.equal(c.end, "2026-08-16", "runs to the Sunday, not to today");
  assert.equal(new Date(parseDay(c.start)).getUTCDay(), 1, "starts on a Monday");
});

test("every column is exactly seven days after the one before", () => {
  const c = buildConstellation([], "2027-01-07"); // across a year boundary
  const starts = c.weeks.map((w) => parseDay(w.start));
  for (let i = 1; i < starts.length; i++) {
    assert.equal(starts[i] - starts[i - 1], 7 * 86_400_000, `gap at ${c.weeks[i].start}`);
  }
});

test("a note lands in the column its week belongs to", () => {
  // Thursday and the Sunday three days later are the SAME week.
  const c = buildConstellation([note("2026-08-13", "Thu"), note("2026-08-16", "Sun")], TODAY);
  assert.equal(c.weeks.at(-1)!.notes.length, 2);
  assert.equal(c.total, 2);

  // The Monday after is a different week — and past the window.
  assert.equal(buildConstellation([note("2026-08-17")], TODAY).total, 0);
});

test("this is the case the day grid got wrong: a lumpy week is one full bar", () => {
  // The real vault: fourteen shelf notes typed up in a single sitting.
  const batch = Array.from({ length: 14 }, (_, n) => note("2026-07-25", `Shelf ${n}`));
  const c = buildConstellation([...batch, note("2026-08-11", "A post")], TODAY);
  const busy = c.weeks.find((w) => w.start === "2026-07-20")!;
  assert.equal(busy.notes.length, 14);
  assert.equal(c.max, 14);
  assert.equal(busy.fill, 1, "the busiest week sets the scale");
});

test("a one-note week is clearly shorter than a busy one, and clearly not empty", () => {
  const batch = Array.from({ length: 14 }, (_, n) => note("2026-07-25", `Shelf ${n}`));
  const c = buildConstellation([...batch, note("2026-08-11", "A post")], TODAY);
  const quiet = c.weeks.at(-1)!;
  assert.ok(quiet.fill >= MIN_FILL, "a week with a note is never a sliver");
  assert.ok(quiet.fill < 0.5, "but it doesn't pretend to be a busy one");
  assert.equal(c.weeks.find((w) => w.start === "2026-06-01")!.fill, 0, "an empty week is empty");
});

test("fill is proportional between the floor and the top", () => {
  assert.equal(fillFor(0, 10), 0);
  assert.equal(fillFor(10, 10), 1);
  assert.equal(fillFor(5, 10), MIN_FILL + (1 - MIN_FILL) * 0.5);
  assert.ok(fillFor(2, 10) > fillFor(1, 10));
  // A lone note in an otherwise empty window is the busiest week there is.
  assert.equal(fillFor(1, 1), 1);
});

test("notes are ordered oldest first inside a week", () => {
  const c = buildConstellation(
    [note("2026-08-13", "Later"), note("2026-08-10", "Earlier")],
    TODAY
  );
  assert.deepEqual(c.weeks.at(-1)!.notes.map((n) => n.title), ["Earlier", "Later"]);
});

test("notes outside the window are dropped, in both directions", () => {
  const c = buildConstellation(
    [note("2019-01-01", "Ancient"), note("2027-01-01", "Postdated"), note(TODAY, "In range")],
    TODAY
  );
  assert.equal(c.total, 1);
  assert.deepEqual(c.weeks.flatMap((w) => w.notes.map((n) => n.title)), ["In range"]);
});

test("the first Monday of the window is inside it; the day before is not", () => {
  const c = buildConstellation([], TODAY);
  const before = dayKey(parseDay(c.start) - 86_400_000);
  assert.equal(buildConstellation([note(c.start)], TODAY).total, 1);
  assert.equal(buildConstellation([note(before)], TODAY).total, 0);
});

test("a date is the same day whatever the build machine's timezone", () => {
  // Parsed through local time, "2026-08-13" is the 12th anywhere west of
  // Greenwich — enough to move a Monday note into the previous column.
  assert.equal(dayKey(parseDay("2026-08-13")), "2026-08-13");
  assert.equal(dayKey(parseDay("2026-01-01")), "2026-01-01");
});

test("junk dates are dropped rather than placed somewhere wrong", () => {
  assert.ok(Number.isNaN(parseDay("")));
  assert.ok(Number.isNaN(parseDay("someday")));
  assert.equal(buildConstellation([note("not a date")], TODAY).total, 0);
});

test("an empty vault produces a flat strip, not a crash", () => {
  const c = buildConstellation([], TODAY);
  assert.equal(c.total, 0);
  assert.equal(c.max, 0);
  assert.ok(c.weeks.every((w) => w.fill === 0));
});
