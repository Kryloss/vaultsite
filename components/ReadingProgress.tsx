"use client";

import { useEffect, useRef } from "react";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";
import {
  buildSegments,
  finishAt,
  progressAt,
  type Block,
  type Segment,
} from "@/lib/reading-progress";

/**
 * A hairline at the very top of the viewport showing how far through the
 * article you are.
 *
 * What it counts, and how, is in lib/reading-progress.ts — briefly: text pays
 * out continuously, media pays out in one step once it has fully passed (so
 * the bar pauses at each figure rather than being driven by it), the page
 * furniture outside the article never counts, and a closing "Sources" heading
 * ends the article early.
 *
 * Driven by a CSS variable rather than a width, so each frame is a compositor
 * transform with no layout work. The element is fixed and its children are
 * absolutely positioned, so the transform can't create a containing block for
 * anything else — worth stating, because a transform on the page wrapper is
 * what once made the Apple Music iframes paint blank on WebKit (see
 * DECISIONS #10 and the note in globals.css).
 */

/**
 * Heading slugs that end the reading, matched after stripping the `uk-`
 * namespace (see lib/toc.ts). Add to this if another closing section appears.
 */
const TERMINAL_HEADINGS = new Set(["sources", "джерела"]);

/**
 * Blocks that are looked at rather than read — a figure, an embedded player,
 * an inlined diagram. They still count toward the article's length; they just
 * pay out at their bottom edge instead of continuously, so the bar pauses
 * while one is passing (see lib/reading-progress.ts).
 */
const MEDIA =
  "figure, img, svg, iframe, video, .youtube-block, .apple-music-block, .excalidraw";

/**
 * The remaining-time pill stays out of the way at both ends: before this much
 * has been read it would just repeat the estimate already in the header, and
 * past the upper bound "0 min left" is noise at the exact moment the reader is
 * finishing a sentence.
 */
const PILL_FROM = 0.06;
const PILL_TO = 0.97;

/** How fast the bar catches up to the scroll position: 0…1 per frame. */
const EASE = 0.18;
/** Below this, snap instead of easing — stops it creeping for ever. */
const SETTLED = 0.0005;

export default function ReadingProgress({ minutes }: { minutes?: number }) {
  const barRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);
  /** Last number written, so the text isn't rewritten sixty times a second. */
  const lastShown = useRef(-1);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let segments: Segment[] = [];
    /** The value at which the bar is full — see finishAt(). */
    let finish = 0;
    /** Where the bar is, vs. where the scroll position says it should be. */
    let shown = 0;
    let target = 0;
    let frame = 0;
    let settled = true;

    /**
     * Rebuild the list of blocks.
     *
     * Cached rather than recomputed per frame, which is what keeps this
     * cheaper than the version it replaces: measuring every paragraph sixty
     * times a second would be far worse than the single rect read it used to
     * do. The observers below re-run it whenever anything could have moved.
     */
    const measure = () => {
      const article = Array.from(
        document.querySelectorAll<HTMLElement>(".prose")
      ).find((el) => el.offsetParent !== null); // skips the hidden language

      segments = [];
      finish = 0;
      if (!article) return;

      // Everything from a terminal heading onward is reference, not reading.
      let stop = Infinity;
      for (const h of article.querySelectorAll<HTMLElement>("h2[id]")) {
        if (TERMINAL_HEADINGS.has(h.id.replace(/^uk-/, ""))) {
          stop = h.getBoundingClientRect().top + window.scrollY;
          break;
        }
      }

      const blocks: Block[] = [];
      for (const child of Array.from(article.children)) {
        if (!(child instanceof HTMLElement)) continue;
        const rect = child.getBoundingClientRect();
        if (!rect.height) continue; // display:none, or empty

        blocks.push({
          top: rect.top + window.scrollY,
          height: rect.height,
          // Either the block IS media, or it only wraps some: rehypeFigures
          // already turns a lone image into a <figure>, so the second case
          // mostly catches hand-written HTML in a note.
          media: child.matches(MEDIA) || !child.textContent?.trim(),
        });
      }

      ({ segments } = buildSegments(blocks, stop));
      // Measured here, not per frame: it only changes when the layout does,
      // and this runs on exactly those occasions.
      finish = finishAt(segments, document.documentElement.clientHeight);
    };

    const paint = () => {
      bar.style.setProperty("--p", String(shown));
      // Hidden until there's something to report, so a short page or the very
      // top of a long one doesn't show a stub of a bar.
      bar.style.opacity = shown > 0.001 ? "1" : "0";

      /* Minutes left, from the same number the bar is drawing — the estimate
         and the progress can't disagree because there's only one of each.
         Rounded UP, so a part-minute reads as a minute rather than as nothing
         left to read; the DOM is only touched when that number changes. */
      const pill = pillRef.current;
      if (!pill || !minutes) return;
      const visible = shown >= PILL_FROM && shown <= PILL_TO;
      pill.hidden = !visible;
      if (!visible) return;
      const left = Math.max(1, Math.ceil(minutes * (1 - shown)));
      if (left === lastShown.current) return;
      lastShown.current = left;
      if (numberRef.current) numberRef.current.textContent = String(left);
    };

    const tick = () => {
      frame = 0;
      const diff = target - shown;
      if (reduced || Math.abs(diff) < SETTLED) {
        shown = target;
        settled = true;
      } else {
        shown += diff * EASE;
        settled = false;
      }
      paint();
      if (!settled) frame = requestAnimationFrame(tick);
    };

    const update = () => {
      // The read line is the TOP of the viewport — see lib/reading-progress.ts
      // for why measuring at the bottom edge cost the opening of every article.
      target = progressAt(segments, window.scrollY, finish);
      // Easing runs on its own rAF chain so the bar keeps gliding after the
      // scroll stops — that trailing motion is most of what makes it feel
      // attached to the page rather than snapped to it.
      settled = false;
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const remeasure = () => {
      measure();
      update();
    };

    measure();
    // First paint lands where the reader actually is, with no glide from zero
    // — they may have arrived on a #heading link partway down.
    shown = target = progressAt(segments, window.scrollY, finish);
    paint();

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", remeasure);
    // Switching language swaps which article is visible, and its height.
    window.addEventListener("langchange", remeasure);
    // Lazy images and embeds arriving change where every block below them sits.
    const ro = new ResizeObserver(remeasure);
    for (const el of document.querySelectorAll(".prose")) ro.observe(el);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("langchange", remeasure);
    };
  }, [minutes]);

  return (
    <>
      <div ref={barRef} className="reading-progress" aria-hidden>
        <span className="reading-progress-fill" />
        <span className="reading-progress-head" />
      </div>
      {/* Bottom-RIGHT, opposite the contents pill: one chip says where you
          are, the other how much is left. Rendered only where the header
          carries a reading estimate, which is posts (see readingStats). */}
      {minutes ? (
        <div ref={pillRef} className="time-left" hidden>
          <span ref={numberRef}>{minutes}</span> <T {...ui.minLeft} />
        </div>
      ) : null}
    </>
  );
}
