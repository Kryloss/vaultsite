/**
 * Star-rating geometry, shared by the two things that draw one.
 *
 * There are two renderers and there have to be: `components/Stars.tsx` draws
 * the rating on a shelf card in JSX, and `rehypeFactTables` in lib/markdown.ts
 * builds the same mark as hast when it appends a `Rating` row to a note's fact
 * list. Neither can call the other — one is React, one is a rehype plugin over
 * a syntax tree. So the SHAPE lives here and each renderer is a dozen lines of
 * plumbing over it. The path is the thing that would drift; it doesn't.
 *
 * The half-star is drawn by CLIPPING rather than by a per-star fill. One row
 * of five outline stars, then the same row again in the filled colour inside a
 * nested <svg> whose width is the rating — a nested svg clips to its own
 * viewport, so no <clipPath> and therefore no id to make unique per instance.
 * That matters: a shelf grid renders a dozen ratings on one page, and ids in
 * generated SVG are the classic way to have them quietly clip each other.
 */

/** One star, drawn in a 24×24 box. */
export const STAR_PATH =
  "M12 2.5l2.95 6.35 6.95.62-5.25 4.62 1.55 6.81L12 17.3l-6.2 3.6 1.55-6.81L2.1 9.47l6.95-.62L12 2.5z";

export const STAR_BOX = 24;
export const STAR_COUNT = 5;

/** Left edge of each star in the row's user units: [0, 24, 48, 72, 96]. */
export const STAR_OFFSETS = Array.from(
  { length: STAR_COUNT },
  (_, i) => i * STAR_BOX
);

/** The row's viewBox width — 120 for five 24px stars. */
export const STARS_WIDTH = STAR_BOX * STAR_COUNT;

/** Clamp to 0–5 and snap to the nearest half, which is all the vault writes. */
export function clampRating(rating: number): number {
  return Math.round(Math.min(Math.max(rating, 0), STAR_COUNT) * 2) / 2;
}

/** How much of the row is filled, as a CSS percentage string. */
export function ratingWidth(rating: number): string {
  return `${(clampRating(rating) / STAR_COUNT) * 100}%`;
}

/**
 * Accessible name. English only, deliberately: it is read by whichever
 * language the reader has chosen, and `<T>` can't reach inside an attribute.
 * The number carries the meaning and it is the same number in both.
 */
export function ratingAriaLabel(rating: number): string {
  return `${clampRating(rating)} out of ${STAR_COUNT} stars`;
}
