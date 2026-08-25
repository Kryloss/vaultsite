/**
 * The one colour a book cover is "about", for the spines on a shelf medium
 * page (components/lists/BookSpines.tsx).
 *
 * Lives in its own file rather than inside sync-assets.mjs so `npm test` can
 * reach it: the vault's covers are the owner's files and may change, so the
 * only honest test of this is a synthetic image with a known answer.
 *
 * Two things make it more than an average:
 *
 * - **Paper and ink are dropped.** Nearly every jacket is mostly white margin
 *   and black type, and both are properties of printing rather than of the
 *   book. A flat mean over all of it returns grey for every cover on the
 *   shelf, which is the one result that makes the whole idea pointless.
 * - **Hue buckets, then average inside the winner.** Averaging what survives
 *   the drop is still wrong: a red cover with a blue band averages to mud
 *   somewhere between them, and mud is a colour neither book has. Bucketing
 *   first picks the largest coherent area and averages only within it.
 *
 * HSL rather than OKLCH on purpose — it is ten lines and adequate here,
 * because the result is clamped into a legible band by lib/spine.ts before it
 * is ever painted. If spines start looking unevenly bright side by side, that
 * is HSL's known failure and the moment to move; not before.
 */

/** Lightness above this is paper, below it is ink. */
const WHITE = 0.92;
const BLACK = 0.08;

/** Below this saturation a pixel has no hue worth bucketing — it's a grey. */
const GREY = 0.15;

/** Hue buckets. 12 × 30° is coarse enough that one colour stays one bucket. */
const BUCKETS = 12;

/** 0–255 RGB → HSL with every channel 0–1. */
function toHsl(r, g, b) {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) * 60;
  else if (max === G) h = ((B - R) / d + 2) * 60;
  else h = ((R - G) / d + 4) * 60;
  return { h, s, l };
}

function hex(r, g, b) {
  const c = (n) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/**
 * @param {Uint8Array|Buffer} pixels Raw interleaved samples — what sharp's
 *   `.raw().toBuffer()` returns.
 * @param {number} channels 3 (RGB) or 4 (RGBA). Alpha is read, not averaged:
 *   a transparent pixel is not part of the picture.
 * @returns {string|undefined} `#rrggbb`, or undefined when there is nothing to
 *   go on (an empty buffer, or an image that is entirely paper).
 */
export function dominantColour(pixels, channels = 3) {
  if (!pixels || pixels.length < channels) return undefined;

  /** Every opaque pixel, so a cover with no colour at all still has a mean. */
  const all = [];
  /** index → { n, r, g, b }, with BUCKETS reserved for the achromatic pile. */
  const buckets = new Map();

  for (let i = 0; i + channels <= pixels.length; i += channels) {
    if (channels === 4 && pixels[i + 3] < 128) continue;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    all.push([r, g, b]);

    const { h, s, l } = toHsl(r, g, b);
    if (l >= WHITE || l <= BLACK) continue;
    const key = s < GREY ? BUCKETS : Math.floor(h / (360 / BUCKETS)) % BUCKETS;
    const acc = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    acc.n++;
    acc.r += r;
    acc.g += g;
    acc.b += b;
    buckets.set(key, acc);
  }

  if (buckets.size === 0) {
    // All paper, all ink, or fully transparent. The mean is the only thing
    // left that is true about the image; an all-white cover deserves a white
    // answer, and lib/spine.ts is what makes it legible.
    if (all.length === 0) return undefined;
    const n = all.length;
    return hex(
      all.reduce((t, p) => t + p[0], 0) / n,
      all.reduce((t, p) => t + p[1], 0) / n,
      all.reduce((t, p) => t + p[2], 0) / n
    );
  }

  /* Largest bucket wins, and a tie goes to the CHROMATIC one: a cover that is
     half grey and half red is remembered as the red one. */
  let best;
  let bestKey;
  for (const [key, acc] of buckets) {
    if (
      !best ||
      acc.n > best.n ||
      (acc.n === best.n && bestKey === BUCKETS && key !== BUCKETS)
    ) {
      best = acc;
      bestKey = key;
    }
  }
  return hex(best.r / best.n, best.g / best.n, best.b / best.n);
}
