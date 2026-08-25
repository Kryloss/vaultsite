/**
 * The maths behind a book spine — see components/lists/BookSpines.tsx.
 *
 * Pure and fs-free on purpose: the values come in as props from the shelf
 * model, so this file can be tested by `npm test` and could be reached from
 * the browser without dragging the image manifest along (DECISIONS #15).
 *
 * Two questions, both answered from the cover itself rather than from the
 * site's palette:
 *
 * - **What colour is the spine?** The cover's dominant colour, clamped into a
 *   band you can put text on. It does NOT flip with the theme — the colour
 *   belongs to the book, and the contrast that matters is internal to the
 *   spine (its own text against its own ground), so the page's ground never
 *   enters into it and one value serves light and dark alike. This is also
 *   why the two hex literals below are literals rather than tokens: they are
 *   ink on the book, not on the page, and `--text` would flip with the theme
 *   and destroy the contrast this function just computed.
 * - **How tall is the spine?** From the cover's aspect ratio, so a tall book
 *   is a tall book. Never from a hash or a random seed — that would look
 *   identical and mean nothing, which is a worse lie than uniformity.
 */

/**
 * The legible band, as HSL lightness.
 *
 * Below the floor a spine is a hole punched in a dark page; above the ceiling
 * it dissolves into a light one. The 1px border every spine carries does the
 * rest of that job, so the band only has to keep the ground far enough from
 * both ends that one of the two inks below clears it comfortably.
 */
const L_MIN = 0.24;
const L_MAX = 0.74;

/**
 * Saturation ceiling. Nothing on this site shouts, and a neon jacket
 * reproduced faithfully at 44 × 214 would be the loudest object on any page
 * it appeared on. Every cover in the vault today is well under this — it is
 * here for the one that isn't.
 */
const S_MAX = 0.8;

/** Ink. Near-, not pure: pure black on a colour reads as a hole. */
const DARK = "#16161a";
const LIGHT = "#f6f5f2";

/** Aspect ratios (h / w) mapped onto the height range. */
const AR_MIN = 1.3;
const AR_MAX = 1.7;

export const SPINE_H_MIN = 196;
export const SPINE_H_MAX = 232;
/** A book with no cover to measure stands at the middle of the range. */
export const SPINE_H_DEFAULT = Math.round((SPINE_H_MIN + SPINE_H_MAX) / 2);

export interface SpineStyle {
  /** `#rrggbb` ground, or undefined when there is no cover to borrow from. */
  bg?: string;
  /** Ink chosen against `bg`. Present exactly when `bg` is. */
  fg?: string;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** `#rgb` or `#rrggbb` → [r, g, b] 0–255, or undefined for anything else. */
function parseHex(hex: string): [number, number, number] | undefined {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return undefined;
  const h =
    m[1].length === 3
      ? m[1]
          .split("")
          .map((c) => c + c)
          .join("")
      : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function toHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    clamp(Math.round(n), 0, 255)
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function rgbToHsl(r: number, g: number, b: number) {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === R
      ? ((G - B) / d + (G < B ? 6 : 0)) * 60
      : max === G
        ? ((B - R) / d + 2) * 60
        : ((R - G) / d + 4) * 60;
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** WCAG relative luminance, for choosing the ink. */
function luminance(r: number, g: number, b: number): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The ground and ink for one spine.
 *
 * An unusable or missing `dom` returns an EMPTY object rather than a grey —
 * the fallback spine is a designed thing (`--surface` ground, secondary text,
 * same border) and CSS owns it, so the component's job is only to say nothing
 * rather than to invent a colour. Every book in the vault has a local cover
 * today, so this is the path the content will never exercise; it has a test
 * instead of a reader.
 */
export function spineStyle(dom?: string): SpineStyle {
  const rgb = dom ? parseHex(dom) : undefined;
  if (!rgb) return {};

  const { h, s, l } = rgbToHsl(...rgb);
  const [r, g, b] = hslToRgb(h, Math.min(s, S_MAX), clamp(l, L_MIN, L_MAX));
  const bg = toHex(r, g, b);

  /* Measured rather than assumed. A lightness threshold gets yellows and
     mid-greens wrong — they are far brighter than their HSL lightness says —
     so both inks are tried and the one that actually reads wins. */
  const lum = luminance(r, g, b);
  const fg =
    contrast(lum, luminance(...(parseHex(DARK) as [number, number, number]))) >=
    contrast(lum, luminance(...(parseHex(LIGHT) as [number, number, number])))
      ? DARK
      : LIGHT;

  return { bg, fg };
}

/**
 * Spine height in px, from the cover's aspect ratio (h / w).
 *
 * Monotonic and clamped at both ends: a squarer-than-usual scan doesn't make
 * a book shorter than the shelf's floor, and an unusually tall one doesn't
 * tower. Width stays uniform — thickness would want a page count, and the
 * vault has none.
 */
export function spineHeight(ar?: number): number {
  if (!ar || !Number.isFinite(ar) || ar <= 0) return SPINE_H_DEFAULT;
  const t = clamp((ar - AR_MIN) / (AR_MAX - AR_MIN), 0, 1);
  return Math.round(SPINE_H_MIN + t * (SPINE_H_MAX - SPINE_H_MIN));
}
