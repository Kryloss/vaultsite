"use client";

import { useEffect } from "react";
import { shouldReveal, type RevealTiming } from "@/lib/image-reveal";

/**
 * A picture that has just arrived sharpens out of its blur placeholder
 * (`img[data-reveal]` in globals.css, DECISIONS #231).
 *
 * One listener for the whole site rather than a prop on every `<img>`: content
 * images are build-time HTML with no component to hang an `onLoad` on, and
 * `load` does not bubble but can be caught on the way down. Same
 * event-delegation approach as Lightbox and CodeCopy.
 *
 * Nothing is ever hidden waiting for this. An image is visible the moment the
 * browser paints it; the attribute only adds a filter on top for a moment, so
 * without JavaScript, or if this never runs, pictures load as they always did.
 *
 * It follows `loading="lazy"` by itself: only an image the browser actually
 * fetched fires `load`, so a shelf row reveals the covers on screen and the
 * rest as they are scrolled to.
 *
 * Opt out a subtree with `data-no-reveal` (the Coverflow, the music backdrop,
 * the spine hover covers, the lightbox). Which loads count as an arrival is
 * `shouldReveal()` in lib/image-reveal.ts.
 */
export default function ImageReveal() {
  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)");

    /* The latest fetch per URL. Kept here rather than read back with
       `performance.getEntriesByName`: the browser's own buffer stops at 250
       entries, which a long look round the shelf passes, and an observer is
       handed every entry regardless. */
    const fetched = new Map<string, RevealTiming>();
    const record = (list: PerformanceEntryList) => {
      for (const e of list as PerformanceResourceTiming[]) {
        if (e.initiatorType !== "img") continue;
        fetched.set(e.name, {
          transferSize: e.transferSize,
          encodedBodySize: e.encodedBodySize,
          duration: e.duration,
          responseEnd: e.responseEnd,
        });
      }
    };
    const timings = new PerformanceObserver((list) => record(list.getEntries()));
    timings.observe({ type: "resource", buffered: true });

    const onLoad = (e: Event) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || still.matches) return;
      // The entry for this very fetch may still be queued for the observer.
      record(timings.takeRecords());
      const src = img.currentSrc || img.src;
      if (
        shouldReveal({
          src,
          width: img.clientWidth,
          optedOut: img.closest("[data-no-reveal]") !== null,
          timing: fetched.get(src),
          now: performance.now(),
        })
      ) {
        img.setAttribute("data-reveal", "");
      }
    };

    /* Over, or interrupted: a press may be about to open the lightbox, whose
       zoom snapshots the picture as it is at that instant. */
    const settle = (e: Event) => {
      if (e.target instanceof HTMLImageElement) e.target.removeAttribute("data-reveal");
    };

    document.addEventListener("load", onLoad, true);
    document.addEventListener("animationend", settle, true);
    document.addEventListener("animationcancel", settle, true);
    document.addEventListener("pointerdown", settle, true);
    return () => {
      timings.disconnect();
      document.removeEventListener("load", onLoad, true);
      document.removeEventListener("animationend", settle, true);
      document.removeEventListener("animationcancel", settle, true);
      document.removeEventListener("pointerdown", settle, true);
    };
  }, []);

  return null;
}
