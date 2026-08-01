/**
 * The arithmetic behind the reading bar (components/ReadingProgress.tsx),
 * kept apart from the DOM so it can be reasoned about and tested on its own.
 *
 * The component decides which blocks are text and which are media — figures,
 * embeds, diagrams — and measures them. Everything here works in document-space
 * pixels and knows nothing about elements.
 *
 * **The model.** Every block counts toward the length of the article, media
 * included: a post that is mostly photographs is still mostly that post, and a
 * bar that ignored them would fill long before the page ended. What differs is
 * *when* a block pays out.
 *
 * - **Text** pays out continuously, at its full height. Crossing half a
 *   paragraph advances the bar by half that paragraph.
 * - **Media** is worth `MEDIA_WEIGHT` of its height, and pays out all at once
 *   at its bottom edge. While a figure is passing the bar holds still; when it
 *   has finished, the bar takes its (discounted) share in one step. So the bar
 *   stops at each image rather than being driven by it — and with the easing in
 *   the component, that step reads as a glide.
 *
 * The discount is what keeps a page of scans from being mostly bar-by-picture:
 * a full-width image is several times the height of the paragraph explaining
 * it, but nowhere near several times the attention.
 *
 * **Where "here" is: the TOP of the viewport.** A block pays out as it scrolls
 * off the top, so the bar answers "how much have I put behind me". The
 * alternative — measuring at the viewport's bottom edge, i.e. "how much have I
 * seen" — reads better in theory and fails badly in practice: on a tall screen
 * the opening screenful of an article is visible before any scrolling, so it
 * has to be treated as already read, and then scrolling through it earns
 * nothing at all. On the war-newspaper post that silently made the entire
 * introduction worth 0% of the bar.
 *
 * **The finish line is the article's end reaching the viewport's bottom** —
 * `finishAt()`. The bar completes when the last line comes into view rather
 * than a screen-height later, and the final screenful isn't dead space.
 *
 * Between those two, the bar reads 0 on arrival and 1 at the end, on any
 * viewport height, and every pixel in between is worth something.
 */

export interface Block {
  /** Document-space offset of the block's top edge. */
  top: number;
  height: number;
  /** Looked at rather than read — pays out only once fully passed. */
  media?: boolean;
}

/**
 * What a pixel of media is worth against a pixel of prose. A full-width image
 * is several times the height of the paragraph that introduces it and nowhere
 * near several times the reading, so it's discounted rather than counted
 * one-for-one. Raise it toward 1 to make the bar track the page more literally.
 */
export const MEDIA_WEIGHT = 0.5;

export interface Segment {
  /** Document geometry, used to locate the scroll line. */
  top: number;
  bottom: number;
  /** What this block is worth on the bar — its height, discounted if media. */
  value: number;
  /** Running total BEFORE this block — what a held media block reports. */
  before: number;
  /** Running total including this block. */
  cumulative: number;
  media: boolean;
}

/**
 * Lay the blocks out end to end, cutting off at `stop` — the document offset
 * of a closing "Sources" heading, if the note has one.
 *
 * Geometry and worth are tracked separately: `top`/`bottom` say where a block
 * is on the page, `value` says how much of the bar it accounts for. They stop
 * being the same number the moment media is discounted.
 */
export function buildSegments(
  blocks: Block[],
  stop = Infinity,
  mediaWeight = MEDIA_WEIGHT
): { segments: Segment[]; total: number } {
  const segments: Segment[] = [];
  let total = 0;

  for (const block of blocks) {
    if (block.height <= 0) continue;
    const top = block.top;
    const bottom = Math.min(top + block.height, stop);
    // Entirely at or past the cutoff.
    if (bottom <= top) continue;

    const media = !!block.media;
    const value = (bottom - top) * (media ? mediaWeight : 1);
    const before = total;
    total += value;
    segments.push({ top, bottom, value, before, cumulative: total, media });
  }

  return { segments, total };
}

/** How much of the article lies above `line`. */
export function consumedAt(segments: Segment[], line: number): number {
  let read = 0;
  for (const s of segments) {
    if (line >= s.bottom) read = s.cumulative;
    else if (line > s.top) {
      // Mid-block: media gives nothing until it's done; text gives the share
      // of its own worth that has passed — proportional, so it stays correct
      // if text is ever weighted too.
      read = s.media
        ? s.before
        : s.before + (s.value * (line - s.top)) / (s.bottom - s.top);
    } else break;
  }
  return read;
}

/**
 * The value at which the bar is full: what has passed the top of the viewport
 * at the moment the article's last line reaches the bottom of it.
 *
 * Returns 0 when there's nothing to track — an article shorter than the
 * viewport is entirely visible on arrival, and a bar for it would be a lie in
 * either direction. The component hides it in that case.
 */
export function finishAt(segments: Segment[], viewportHeight: number): number {
  const last = segments[segments.length - 1];
  if (!last) return 0;
  return consumedAt(segments, last.bottom - viewportHeight);
}

/**
 * Chapter ticks: how close to either end a heading can be and still earn one.
 *
 * The first `h2` of a note usually sits a paragraph in, which would put a
 * notch almost on top of the bar's origin, and a heading in the last breath of
 * an article marks a section nobody needs warning about. Both read as dirt on
 * the line rather than as structure.
 */
export const TICK_EDGE = 0.04;
/** Closer than this to the previous tick and the two are one smudge. */
export const TICK_GAP = 0.03;

/**
 * Which of an article's headings get a notch on the bar.
 *
 * Takes positions ALREADY converted to bar progress (0…1) by `progressAt`,
 * not document offsets: a heading's place on the bar is not its place on the
 * page, because media is discounted and anything past a "Sources" heading
 * isn't counted at all. Converting first is what keeps the notches where the
 * bar actually stops.
 *
 * Returns nothing at all for a single tick: one notch divides the article into
 * "before" and "after" one heading, which that heading already does.
 */
export function chapterTicks(positions: number[]): number[] {
  const ticks: number[] = [];
  for (const p of positions) {
    if (!Number.isFinite(p)) continue;
    if (p < TICK_EDGE || p > 1 - TICK_EDGE) continue;
    if (ticks.length && p - ticks[ticks.length - 1] < TICK_GAP) continue;
    ticks.push(p);
  }
  return ticks.length < 2 ? [] : ticks;
}

/**
 * 0…1. `line` is the TOP of the viewport in document space — i.e. `scrollY` —
 * and `finish` comes from `finishAt()`.
 */
export function progressAt(
  segments: Segment[],
  line: number,
  finish: number
): number {
  if (finish <= 0) return 0;
  return Math.min(1, Math.max(0, consumedAt(segments, line) / finish));
}
