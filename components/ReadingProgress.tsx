"use client";

import { useEffect, useState } from "react";

/**
 * A hairline at the very top of the viewport showing how far through the
 * *article* you are — not the document.
 *
 * Measuring the whole page made the bar lie: the header, the prev/next row and
 * the footer all counted, so it never filled by the time the writing ended.
 * This measures the visible <article> instead, and stops early at a closing
 * reference section, because reaching "Sources" means you've finished reading.
 *
 * Driven by scaleX rather than width so each frame is a compositor transform
 * with no layout work. The element is fixed and childless, so the transform
 * can't create a containing block for anything else — worth stating, because
 * a transform on the page wrapper is what once made the Apple Music iframes
 * paint blank on WebKit (see DECISIONS #10 and the note in globals.css).
 */

/**
 * Heading slugs that end the reading, matched after stripping the `uk-`
 * namespace (see lib/toc.ts). Add to this if another closing section appears.
 */
const TERMINAL_HEADINGS = new Set(["sources", "джерела"]);

export default function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    /**
     * Document offsets of the stretch that counts as reading.
     *
     * Recomputed every frame rather than cached: lazy-loaded images, embeds
     * and the language toggle all change these, and one rect read per frame
     * inside rAF is far cheaper than the bugs from a stale cache.
     */
    const bounds = () => {
      const article = Array.from(
        document.querySelectorAll<HTMLElement>(".prose")
      ).find((el) => el.offsetParent !== null); // skips the hidden language
      if (!article) return null;

      const top = article.getBoundingClientRect().top + window.scrollY;
      let end = top + article.offsetHeight;

      for (const h of article.querySelectorAll<HTMLElement>("h2[id]")) {
        if (TERMINAL_HEADINGS.has(h.id.replace(/^uk-/, ""))) {
          end = h.getBoundingClientRect().top + window.scrollY;
          break;
        }
      }
      return { top, end };
    };

    const measure = () => {
      frame = 0;
      const b = bounds();
      if (!b) return setProgress(0);

      // Full when the end of the article reaches the bottom of the viewport.
      const travel = b.end - b.top - document.documentElement.clientHeight;
      if (travel <= 0) return setProgress(0); // fits on screen; nothing to track
      const p = (window.scrollY - b.top) / travel;
      setProgress(Math.min(1, Math.max(0, p)));
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    // Switching language swaps which article is visible, and its height.
    window.addEventListener("langchange", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("langchange", onScroll);
    };
  }, []);

  return (
    <div
      className="reading-progress"
      style={{ transform: `scaleX(${progress})` }}
      aria-hidden
    />
  );
}
