"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";
import { markRead, READ_AT } from "@/lib/read-notes";
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

/**
 * Name of the event carrying the remaining minutes to the rest of the page.
 *
 * On a phone the number is shown in the floating bar at the top-left rather
 * than in its own pill (see components/Chrome.tsx), and that bar belongs to
 * the site chrome while this number belongs to the article. A custom event is
 * how the two talk — the same approach `langchange` already uses — instead of
 * a context provider wrapping the whole tree for one integer.
 */
export const TIME_LEFT_EVENT = "timeleft";

/** `null` means "nothing to report" — too early, finished, or not an article. */
function publish(minutes: number | null) {
  window.dispatchEvent(new CustomEvent(TIME_LEFT_EVENT, { detail: minutes }));
}

/** How fast the bar catches up to the scroll position: 0…1 per frame. */
const EASE = 0.18;
/** Below this, snap instead of easing — stops it creeping for ever. */
const SETTLED = 0.0005;

export default function ReadingProgress({ minutes }: { minutes?: number }) {
  const pathname = usePathname();
  const barRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);
  /**
   * Last value published, so neither the DOM nor the rest of the page is
   * touched sixty times a second. `null` means "nothing to report".
   */
  const lastShown = useRef<number | null>(null);

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
     * Whether this visit has already been recorded as read. A local rather
     * than a check inside markRead(), because the bar sits past the threshold
     * for the whole end of the article — without it, finishing a note would
     * mean a localStorage read on every scroll frame from 92% to the bottom.
     */
    let marked = false;

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

      /* The bar is the only thing on the site that knows you finished a note
         you had to scroll through, so it is what says so — see
         lib/read-notes.ts. `finish > 0` is that case; the one-screen case is
         markIfShort() below, which has no scrolling to go on. */
      if (!marked && finish > 0 && shown >= READ_AT) {
        marked = true;
        markRead(pathname);
      }

      /* Minutes left, from the same number the bar is drawing — the estimate
         and the progress can't disagree because there's only one of each.
         Rounded UP, so a part-minute reads as a minute rather than as nothing
         left to read. */
      if (!minutes) return;
      const visible = shown >= PILL_FROM && shown <= PILL_TO;
      const left = visible ? Math.max(1, Math.ceil(minutes * (1 - shown))) : null;

      const pill = pillRef.current;
      if (pill) pill.hidden = !visible;
      // Nothing below this line runs on a frame where the minute is unchanged.
      if (left === lastShown.current) return;
      lastShown.current = left;
      if (left !== null && numberRef.current) {
        numberRef.current.textContent = String(left);
      }
      publish(left);
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

    /**
     * A note that fits on one screen is read by being opened.
     *
     * It never moves the bar — `finishAt()` returns 0 for anything shorter
     * than the viewport, because a bar for a note you can see all of would be
     * a lie in either direction — so there is no progress for the threshold to
     * catch, and short notes were never recorded at all. There is also nothing
     * left to measure: the whole note is in front of the reader on arrival.
     * Opening it is the only event there is, so opening it is the signal.
     *
     * Re-checked after every measurement rather than once on mount, because
     * whether the note fits isn't known until it has been measured and can
     * change afterwards — images settling and the language switch both move
     * the article's height.
     */
    const markIfShort = () => {
      if (marked || finish > 0) return;
      marked = true;
      markRead(pathname);
    };

    const remeasure = () => {
      measure();
      markIfShort();
      update();
    };

    measure();
    markIfShort();
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
      // Leaving the article clears the number from the chrome, which outlives
      // this component.
      publish(null);
    };
  }, [minutes, pathname]);

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
