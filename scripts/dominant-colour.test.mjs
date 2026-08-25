import test from "node:test";
import assert from "node:assert/strict";
import { dominantColour } from "./dominant-colour.mjs";

/**
 * The colour of a book cover, from a buffer with a known answer.
 *
 * The vault's covers are the owner's files and can be replaced at any time,
 * so a test that reads one proves nothing durable. These are synthetic
 * images whose right answer is arithmetic.
 */

/** An 8×8 raw RGB buffer from a function of (x, y). */
function image(px, channels = 3) {
  const buf = Buffer.alloc(64 * channels);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const [r, g, b, a = 255] = px(x, y);
      const i = (y * 8 + x) * channels;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      if (channels === 4) buf[i + 3] = a;
    }
  return buf;
}

const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];
const RED = [200, 40, 40];
const BLUE = [40, 60, 200];

/** #rrggbb → [r, g, b]. */
function rgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/** Which channel is the largest — the cheap way to ask "is this red?". */
function hue(hex) {
  const [r, g, b] = rgb(hex);
  if (r > g && r > b) return "red";
  if (b > r && b > g) return "blue";
  if (g > r && g > b) return "green";
  return "grey";
}

const border = (x, y) => x === 0 || y === 0 || x === 7 || y === 7;

test("a red square inside a white border reads as red, not pink", () => {
  // The failure this whole thing exists to avoid: a flat mean over these 64
  // pixels is (255·28 + 200·36) / 64 ≈ 224 red on ≈ 134 green — a washed-out
  // pink that is not on the cover anywhere.
  const dom = dominantColour(image((x, y) => (border(x, y) ? WHITE : RED)));
  assert.equal(hue(dom), "red");
  const [r, g, b] = rgb(dom);
  assert.deepEqual([r, g, b], RED, "the surviving pixels are all one red");
});

test("black type is dropped too", () => {
  const dom = dominantColour(image((x, y) => (border(x, y) ? BLACK : RED)));
  assert.deepEqual(rgb(dom), RED);
});

test("the largest coherent area wins, rather than the average of two", () => {
  // Six columns red, two blue. Averaging what survives would land on purple.
  const dom = dominantColour(image((x) => (x < 6 ? RED : BLUE)));
  assert.equal(hue(dom), "red");
});

test("a cover with no colour at all still gets an answer", () => {
  // Every pixel is a mid grey: nothing is paper, nothing is ink, and the
  // achromatic bucket is all there is. lib/spine.ts makes it legible.
  const dom = dominantColour(image(() => [128, 128, 128]));
  assert.deepEqual(rgb(dom), [128, 128, 128]);
});

test("an all-white image falls back to the mean rather than to nothing", () => {
  // Everything is dropped, so there is no bucket to pick — but the image is
  // still white, and saying so is more useful than saying nothing.
  const dom = dominantColour(image(() => WHITE));
  assert.deepEqual(rgb(dom), [255, 255, 255]);
});

test("transparent pixels are not part of the picture", () => {
  // A PNG logo on transparency: the alpha channel is most of the file and
  // would otherwise drag the answer toward black.
  const dom = dominantColour(
    image((x, y) => (border(x, y) ? [0, 0, 0, 0] : [...RED, 255]), 4),
    4
  );
  assert.deepEqual(rgb(dom), RED);
});

test("an empty buffer has no answer", () => {
  assert.equal(dominantColour(Buffer.alloc(0)), undefined);
  assert.equal(dominantColour(undefined), undefined);
});
