/**
 * Which heading the table of contents should highlight — the arithmetic only,
 * kept apart from the DOM so it can be reasoned about and tested on its own
 * (same split as lib/reading-progress.ts).
 *
 * **The model.** There is a reading line across the viewport, and the active
 * heading is the last one above it. At rest the line sits `READING_LINE` from
 * the top, just under the floating chrome: what you're reading is what has
 * just passed the top of the window.
 *
 * **The line comes down to meet the end of the page.** A fixed line has a dead
 * zone at the bottom exactly one viewport tall — the last screenful of a page
 * can never be scrolled up to the line, so every heading inside it stays
 * unhighlighted no matter how far you scroll. On a wide screen with a tall
 * window and short closing sections, that can be the last three or four
 * entries in the rail: you are visibly at the bottom of the article and the
 * contents still points at the middle of it.
 *
 * So the line is `innerHeight - remaining`, where `remaining` is the scroll
 * left in the page — never higher than its resting place. At the bottom
 * `remaining` is 0 and the line is the foot of the window, so the last heading
 * on screen is active; a screen-height earlier it's back at `READING_LINE` and
 * nothing has changed. In between, the line descends at exactly the rate the
 * page has stopped moving, which is why it doesn't read as motion: the last
 * sections get their turn one after another, as if the page were still
 * scrolling under a line that never moved.
 *
 * A page too short to scroll keeps the resting line — there is no "further
 * down" to bring the line to, and sweeping it to the bottom would highlight
 * the LAST heading of a page you just arrived at the top of.
 */

/**
 * Where the line rests, in px below the top of the viewport.
 *
 * Below the floating breadcrumb bar and the headings' own scroll-margin-top,
 * so a heading you jumped to is counted as reached rather than as one pixel
 * short of it.
 */
export const READING_LINE = 140;

export interface Viewport {
  scrollY: number;
  innerHeight: number;
  /** Full height of the document, footer and all. */
  scrollHeight: number;
}

/** The line's position for a given scroll state, in px from the viewport top. */
export function readingLine({
  scrollY,
  innerHeight,
  scrollHeight,
}: Viewport): number {
  const max = scrollHeight - innerHeight;
  if (max <= 0) return READING_LINE;
  // Clamped at 0 for overscroll — bouncing past the end shouldn't push the
  // line off the bottom of the window.
  const remaining = Math.max(max - scrollY, 0);
  return Math.max(READING_LINE, innerHeight - remaining);
}

/**
 * Index of the active heading, or -1 for "above the first one".
 *
 * `tops` are viewport-relative (`getBoundingClientRect().top`) and in document
 * order; the caller drops the hidden language's headings before measuring, so
 * one list serves both.
 */
export function activeHeading(tops: number[], view: Viewport): number {
  const line = readingLine(view);
  let current = -1;
  for (let i = 0; i < tops.length; i++) {
    if (tops[i] <= line) current = i;
  }
  return current;
}
