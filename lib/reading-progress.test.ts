/**
 * Run with `npm test` — Node's own test runner, no dependencies to install.
 *
 * This covers the reading bar's arithmetic (lib/reading-progress.ts), which is
 * the one piece of the site whose behaviour can't be checked by looking at a
 * built page: it only shows up as a bar that fills at the wrong rate. Two of
 * the cases below are regressions that shipped and had to be found by reading
 * the numbers back — see "an opening screenful still counts".
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSegments,
  consumedAt,
  finishAt,
  progressAt,
} from "./reading-progress.ts";

/** Paragraph, then a 400px figure, then another paragraph. */
const article = [
  { top: 0, height: 100 },
  { top: 100, height: 400, media: true },
  { top: 500, height: 100 },
];

test("media counts toward the article, at half weight", () => {
  const { total } = buildSegments(article);
  // 100 text + (400 media ÷ 2) + 100 text
  assert.equal(total, 400);
});

test("the weight is adjustable", () => {
  assert.equal(buildSegments(article, Infinity, 1).total, 600);
  assert.equal(buildSegments(article, Infinity, 0).total, 200);
});

test("the bar holds while a figure passes, then takes it in one step", () => {
  const { segments } = buildSegments(article);
  // End of the first paragraph.
  assert.equal(consumedAt(segments, 100), 100);
  // Anywhere inside the figure: unchanged.
  assert.equal(consumedAt(segments, 200), 100);
  assert.equal(consumedAt(segments, 499), 100);
  // Its bottom edge: the discounted 200 lands at once.
  assert.equal(consumedAt(segments, 500), 300);
});

test("text is never discounted", () => {
  const { segments, total } = buildSegments(article);
  assert.equal(segments[0].value, 100);
  assert.equal(segments[2].value, 100);
  assert.equal((segments[0].value + segments[2].value) / total, 0.5);
});

test("text still pays out continuously", () => {
  const { segments } = buildSegments([{ top: 0, height: 100 }]);
  assert.equal(consumedAt(segments, 25), 25);
  assert.equal(consumedAt(segments, 75), 75);
});

test("progress starts at zero on any viewport", () => {
  const { segments } = buildSegments(article);
  for (const vh of [200, 400, 599]) {
    assert.equal(progressAt(segments, 0, finishAt(segments, vh)), 0, `vh=${vh}`);
  }
});

/**
 * The regression this model exists to prevent. Measuring at the viewport's
 * BOTTOM edge meant an opening that fitted on one screen was declared read
 * before the reader had scrolled, so scrolling through it earned nothing —
 * on a real post, the entire introduction was worth 0% of the bar.
 */
test("an opening screenful still counts", () => {
  // A 900px opening, then a figure, on a 1000px-tall screen.
  const long = [
    { top: 0, height: 900 },
    { top: 900, height: 400, media: true },
    { top: 1300, height: 900 },
  ];
  const { segments } = buildSegments(long);
  const finish = finishAt(segments, 1000);
  const atOpeningEnd = progressAt(segments, 900, finish);
  assert.ok(atOpeningEnd > 0.4, `opening was worth only ${atOpeningEnd}`);
});

test("the bar is full when the last line comes into view", () => {
  const { segments } = buildSegments(article);
  const vh = 300;
  const finish = finishAt(segments, vh);
  // Article ends at 600, so its last line reaches the viewport bottom here.
  assert.equal(progressAt(segments, 600 - vh, finish), 1);
  assert.equal(progressAt(segments, 9999, finish), 1);
});

test("an article shorter than the viewport reports nothing to track", () => {
  const { segments } = buildSegments([{ top: 0, height: 100 }]);
  assert.equal(finishAt(segments, 900), 0);
  assert.equal(progressAt(segments, 0, finishAt(segments, 900)), 0);
});

test("a terminal heading truncates the article", () => {
  // The last paragraph runs 500–600, but "Sources" starts at 550.
  const { segments, total } = buildSegments(article, 550);
  // 100 text + 200 discounted media + 50 of the truncated paragraph
  assert.equal(total, 350);
  const finish = finishAt(segments, 100);
  assert.equal(progressAt(segments, 550 - 100, finish), 1);
});

test("blocks entirely past the cutoff are dropped", () => {
  const { segments, total } = buildSegments(article, 100);
  assert.equal(total, 100);
  assert.equal(segments.length, 1);
});

test("clamped at both ends", () => {
  const { segments } = buildSegments(article);
  const finish = finishAt(segments, 200);
  assert.equal(progressAt(segments, -1000, finish), 0);
  assert.equal(progressAt(segments, 1e6, finish), 1);
});

test("progress never goes backwards as you scroll", () => {
  const { segments } = buildSegments(article);
  const finish = finishAt(segments, 200);
  let last = -1;
  for (let y = 0; y <= 700; y += 10) {
    const p = progressAt(segments, y, finish);
    assert.ok(p >= last, `dipped at y=${y}`);
    last = p;
  }
});

test("an empty article reports zero, not NaN", () => {
  const { segments, total } = buildSegments([]);
  assert.equal(total, 0);
  assert.equal(finishAt(segments, 800), 0);
  assert.equal(progressAt(segments, 500, 0), 0);
  assert.equal(consumedAt(segments, 500), 0);
});

test("zero-height blocks are ignored", () => {
  const { total } = buildSegments([
    { top: 0, height: 0 },
    { top: 0, height: 50 },
  ]);
  assert.equal(total, 50);
});

