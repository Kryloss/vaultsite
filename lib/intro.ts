/**
 * Timing and cues for the first-visit intro (components/Intro.tsx).
 *
 * Here rather than in the component for the reason the reading bar's maths is:
 * this is behaviour you cannot check by looking at the page. The intro plays
 * once per browser, so the third time you'd want to test it you no longer can
 * without clearing storage, and the case that matters most — the photo landing
 * on the right word in the right language — is one frame of a three-second
 * sequence. Pure functions can just be asserted.
 */

/** Milliseconds per keystroke, and the wobble either side that keeps it human. */
export const KEY = 62;
export const WOBBLE = 13;
/** A comma is a breath. */
export const COMMA = 200;
/**
 * Before the first keystroke, and after the full stop.
 *
 * The lead-in is short because it isn't the whole pause the reader gets: the
 * driver can't run until the page has hydrated, and the caret is already
 * blinking on an empty line by then. A generous lead-in on top of that reads
 * as the page having stalled.
 */
export const LEAD_IN = 180;
export const BEAT = 420;
/** Line-to-line delay in the closing sweep, and how long one line takes. */
export const LINE_STEP = 55;
export const LINE_DUR = 320;
/** Slack after the last line, before the intro hands the page back. */
const LINE_TAIL = 120;
/**
 * The skipped reveal: everything at once, but still a fade. Matches the
 * 160ms in the `[data-intro-fast]` rules, plus slack.
 */
export const SKIP_DUR = 200;

/**
 * How many characters in the photo should appear — the index just past the
 * first name, wherever it falls in the greeting.
 *
 * Cued by the sentence rather than by a stopwatch, so it stays right when the
 * greeting is reworded, when the reader is in Ukrainian (a different name, at
 * a different offset), and whatever speed the typing runs at.
 *
 * Returns Infinity when the name isn't in the text at all: the cue never
 * fires, and the photo arrives with the rest of the page instead of at some
 * arbitrary moment. A greeting that doesn't say the name is a reason to skip
 * the flourish, not to guess.
 */
export function photoCue(text: string, name: string): number {
  if (!name) return Infinity;
  const at = text.indexOf(name);
  return at === -1 ? Infinity : at + Array.from(name).length;
}

/**
 * How long to hold before the next keystroke.
 *
 * `random` is passed in rather than reached for, so the wobble can be pinned
 * in a test. Real typing is uneven; a perfectly metronomic one reads as a
 * progress bar with letters.
 */
export function keyDelay(char: string, random = Math.random()): number {
  if (char === ",") return COMMA;
  return KEY + Math.round(random * WOBBLE * 2) - WOBBLE;
}

/** When the closing sweep is over and the attribute can be dropped. */
export function sweepDuration(lines: number): number {
  return Math.max(0, lines - 1) * LINE_STEP + LINE_DUR + LINE_TAIL;
}
