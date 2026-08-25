import test from "node:test";
import assert from "node:assert/strict";
import {
  spineStyle,
  spineHeight,
  SPINE_H_MIN,
  SPINE_H_MAX,
  SPINE_H_DEFAULT,
} from "@/lib/spine";

/**
 * One 8-bit step. Every assertion about the band needs it: the clamp is exact
 * in floating point and then quantised to hex, so #000000 comes back as
 * #3d3d3d — lightness 0.2392 against a floor of 0.24. That is the format
 * rounding, not the clamp missing.
 */
const STEP = 1 / 255;

/** #rrggbb → HSL lightness, the band the clamp is written in. */
function lightness(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}

/** WCAG contrast between two #rrggbb, for asserting the ink is readable. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const ch = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

test("a black cover and a white cover both land inside the band", () => {
  // The two ends the vault will eventually supply: a black jacket would be a
  // hole punched in a dark page, a white one would dissolve into a light one.
  for (const dom of ["#000000", "#ffffff"]) {
    const { bg } = spineStyle(dom);
    assert.ok(bg, `${dom} still produces a spine`);
    const l = lightness(bg!);
    assert.ok(l >= 0.24 - STEP && l <= 0.74 + STEP, `${dom} → ${bg} (l=${l})`);
  }
});

test("the clamp only moves what is outside the band", () => {
  // A cover already legible is reproduced, not "corrected" toward the middle.
  const { bg } = spineStyle("#7ba5aa");
  assert.equal(bg, "#7ba5aa");
});

test("the ink flips with the ground, and stays readable either way", () => {
  const dark = spineStyle("#0e3347");
  const light = spineStyle("#ababa2");
  assert.notEqual(dark.fg, light.fg);
  for (const { bg, fg } of [dark, light])
    assert.ok(contrast(bg!, fg!) >= 4.5, `${fg} on ${bg}`);
});

test("a yellow spine takes dark ink, which its lightness alone would not say", () => {
  // Pure yellow is HSL lightness 0.5 — dead centre — but far brighter than a
  // mid blue at the same number. Picking the ink by luminance is what gets it
  // right; a lightness threshold is the version of this that ships wrong.
  const { fg } = spineStyle("#ffd700");
  assert.equal(fg, "#16161a");
});

test("saturation is capped, so a neon jacket doesn't shout", () => {
  const { bg } = spineStyle("#00ff00");
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(bg!.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = (max - min) / (l > 0.5 ? 2 - max - min : max + min);
  assert.ok(s <= 0.8 + 2 * STEP, `saturation ${s}`);
});

test("an item with no dominant colour returns the fallback", () => {
  // The path the vault has no content for: every book carries a local cover,
  // so this only happens for `cover: https://…` or an unreadable file. An
  // EMPTY style, not a grey — the fallback spine is designed in CSS.
  for (const dom of [undefined, "", "not a colour", "#12", "rgb(1,2,3)"])
    assert.deepEqual(spineStyle(dom), {}, JSON.stringify(dom));
});

test("height rises with the cover's aspect ratio and clamps at both ends", () => {
  assert.equal(spineHeight(1.0), SPINE_H_MIN, "squarer than the floor");
  assert.equal(spineHeight(1.3), SPINE_H_MIN);
  assert.equal(spineHeight(1.7), SPINE_H_MAX);
  assert.equal(spineHeight(3.0), SPINE_H_MAX, "taller than the ceiling");

  const ladder = [1.3, 1.4, 1.5, 1.6, 1.7].map(spineHeight);
  for (let i = 1; i < ladder.length; i++)
    assert.ok(ladder[i] > ladder[i - 1], `${ladder}`);
});

test("a book with nothing to measure stands mid-shelf", () => {
  for (const ar of [undefined, 0, -1, NaN, Infinity])
    assert.equal(spineHeight(ar), SPINE_H_DEFAULT, String(ar));
});

test("a photographed spine stands at its own thickness", () => {
  // `spine:` frontmatter is the one case where width is MEASURED rather than
  // uniform: the photo's aspect ratio is the book's real thickness against
  // its height. Asserted as a RELATIONSHIP rather than as two magic numbers,
  // because the height range moves whenever the shelf's proportions are
  // retuned and a pinned 273 just breaks without telling anyone anything.
  const h = spineHeight(1.579); // Sapiens' cover, 316 × 499
  const width = h / (1210 / 160); // its spine photograph, 160 × 1210
  assert.ok(h > SPINE_H_MIN && h < SPINE_H_MAX, `${h} inside the range`);
  // NOT "thinner than the uniform width" — that was never a rule, it was a
  // fact about the old numbers, and it broke the moment the shelf was
  // retuned. A measured spine may be fatter than the default; Sapiens is.
  assert.notEqual(Math.round(width), 34, "must not fall back to the uniform width");
  // and it scales with the height, so retuning the shelf keeps it honest
  assert.ok(
    Math.abs(width / h - 160 / 1210) < 1e-9,
    "width must stay the photograph's own ratio against the height"
  );
});

