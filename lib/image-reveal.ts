/**
 * Which images get the reveal (components/ImageReveal.tsx, DECISIONS #231).
 *
 * The reveal is for a picture that has just ARRIVED: the visitor was looking
 * at its blur placeholder and the file came in over the network. An image the
 * browser already had must simply be there, or every visit after the first,
 * every back button and every re-render would replay the animation.
 *
 * Pure, with no DOM in it, so `npm test` can cover the cases a built page
 * can't show on demand: a cache hit, a 304, a remount.
 */

/** The fields of a PerformanceResourceTiming entry this needs. */
export interface RevealTiming {
  transferSize: number;
  encodedBodySize: number;
  duration: number;
  responseEnd: number;
}

/** Below this painted width it is an icon or an avatar, not a picture. */
export const REVEAL_MIN_WIDTH = 48;

/**
 * How long after the bytes finished the `load` event may still belong to that
 * fetch (decoding a large photo takes a moment). A `load` later than this was
 * not caused by the fetch on record: the element was mounted again and the
 * browser handed it the copy in memory.
 */
export const REVEAL_FRESH_MS = 1000;

/** A cross-origin fetch this quick did not touch the network. */
const OPAQUE_CACHE_MS = 20;

/**
 * True when the response came from the HTTP cache, validated or not.
 *
 * A network response always transfers at least its body, so `transferSize`
 * below `encodedBodySize` means the body was not sent: that is a plain cache
 * hit, which transfers 0. A 304 is the other way round as Chrome reports it:
 * headers transferred (300) and no body at all. That one matters most, since
 * Vercel serves `public/` with `max-age=0, must-revalidate` and every repeat
 * visit is a run of 304s. A cross-origin image without `Timing-Allow-Origin`
 * reports both as 0, and only its duration is left to go by.
 */
export function servedFromCache(t: RevealTiming): boolean {
  if (t.transferSize === 0 && t.encodedBodySize === 0) return t.duration < OPAQUE_CACHE_MS;
  return t.transferSize < t.encodedBodySize || t.encodedBodySize === 0;
}

export function shouldReveal(input: {
  /** `currentSrc`: the candidate the browser actually picked. */
  src: string;
  /** Painted width in CSS pixels. 0 for an image that is `display: none`. */
  width: number;
  /** Inside `[data-no-reveal]`. */
  optedOut: boolean;
  /** The latest fetch on record for `src`, if any. */
  timing?: RevealTiming;
  /** `performance.now()` when the `load` event fired. */
  now: number;
}): boolean {
  const { src, width, optedOut, timing, now } = input;
  if (optedOut || width < REVEAL_MIN_WIDTH) return false;
  // Line art has no blur placeholder to sharpen from, and a diagram going soft
  // and bright for half a second reads as a glitch.
  if (!src || src.startsWith("data:") || /\.svg(?:[?#]|$)/i.test(src)) return false;
  // Nothing on record: no way to tell an arrival from a repaint, so stay still.
  if (!timing) return false;
  if (now - timing.responseEnd > REVEAL_FRESH_MS) return false;
  return !servedFromCache(timing);
}
