"use client";

import { useEffect } from "react";

/**
 * Smooth scrolling for the "#" links beside headings (lib/toc.ts).
 *
 * Those anchors are raw HTML inside dangerouslySetInnerHTML, so they can't
 * carry an onClick — one delegated listener on the document handles all of
 * them, the same shape as components/CodeCopy.tsx. Mounted in the root layout
 * because headings appear on entry pages, section pages and the projects feed.
 *
 * Left alone they'd fall back to plain hash navigation, which animates only if
 * `scroll-behavior: smooth` applies — and globals.css turns that off under
 * prefers-reduced-motion, so those readers got an instant jump here while the
 * table of contents glided. This matches the two.
 */
export default function HeadingAnchors() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Leave modified clicks alone — open-in-new-tab and copy-link still work.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
        return;
      }

      const target = e.target as Element | null;
      const anchor = target?.closest?.("a.heading-anchor");
      const href = anchor?.getAttribute("href");
      if (!href?.startsWith("#")) return;

      const id = decodeURIComponent(href.slice(1));
      const el = id ? document.getElementById(id) : null;
      if (!el) return;

      e.preventDefault();
      // block: "start" honours the heading's scroll-margin-top, so the target
      // clears the floating header instead of hiding under it.
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      history.pushState(null, "", `#${id}`);
      // pushState is silent by design; the table of contents listens for this
      // to pin its highlight to the heading just jumped to.
      window.dispatchEvent(new Event("hashchange"));
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
