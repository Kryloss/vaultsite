/**
 * Star geometry (lib/stars.ts). Worth testing because TWO renderers read it —
 * components/Stars.tsx in JSX and `rehypeFactTables` in lib/markdown.ts as
 * hast — and a change here silently moves both. The half-star in particular
 * is drawn by a clip width, so an off-by-one in the percentage is a rating
 * that reads wrong rather than a layout that looks broken.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STARS_WIDTH,
  STAR_OFFSETS,
  clampRating,
  ratingAriaLabel,
  ratingWidth,
} from "./stars.ts";

test("ratings snap to the nearest half", () => {
  assert.equal(clampRating(4.5), 4.5);
  assert.equal(clampRating(4.3), 4.5);
  assert.equal(clampRating(4.1), 4);
  assert.equal(clampRating(3.74), 3.5);
});

test("ratings are clamped to the 0–5 range", () => {
  assert.equal(clampRating(-2), 0);
  assert.equal(clampRating(9), 5);
  assert.equal(clampRating(5), 5);
});

test("the clip width is the rating as a percentage of five", () => {
  assert.equal(ratingWidth(5), "100%");
  assert.equal(ratingWidth(4.5), "90%");
  assert.equal(ratingWidth(2.5), "50%");
  assert.equal(ratingWidth(0), "0%");
});

test("the star row is five stars wide, evenly spaced", () => {
  assert.deepEqual(STAR_OFFSETS, [0, 24, 48, 72, 96]);
  assert.equal(STARS_WIDTH, 120);
});

test("the accessible name states the rating out of five", () => {
  assert.equal(ratingAriaLabel(4.5), "4.5 out of 5 stars");
  assert.equal(ratingAriaLabel(4.3), "4.5 out of 5 stars");
});
