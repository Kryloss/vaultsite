"use client";

import { useEffect, useRef, useState } from "react";
import type { Heading } from "@/lib/toc";

/**
 * Table of contents — a fixed rail to the right of the article on wide screens,
 * hidden below the width where it would crowd the text (see .toc-rail in
 * globals.css).
 *
 * Bilingual like everything else: both outlines ship in the HTML and CSS shows
 * the active one. The scroll-spy walks the merged list and skips anything whose
 * language is currently hidden — a display:none heading has no offsetParent, so
 * the check costs nothing and keeps one observer serving both languages.
 *
 * Jumping to a heading pins the highlight to it (see `held` below).
 */

/** Keys that mean "the reader is moving the page themselves". */
const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
]);

export default function Toc({ en, uk }: { en: Heading[]; uk?: Heading[] }) {
  const [active, setActive] = useState("");
  /**
   * The heading the reader jumped to, held until they scroll again.
   *
   * Without this the spy overrules the click: it highlights whatever sits at
   * the top of the viewport, and a short section — or any heading near the end
   * of the page, which can't scroll far enough to reach the top — leaves the
   * clicked item unhighlighted. Smooth scrolling makes it worse, since the spy
   * runs through every heading on the way down.
   */
  const held = useRef<string | null>(null);
  const ids = [...en, ...(uk ?? [])].map((h) => h.id).join(",");

  useEffect(() => {
    const list = ids.split(",").filter(Boolean);
    let frame = 0;

    const measure = () => {
      frame = 0;
      if (held.current) return; // pinned to the heading that was jumped to
      let current = "";
      for (const id of list) {
        const el = document.getElementById(id);
        // offsetParent is null for the hidden language's headings.
        if (!el || el.offsetParent === null) continue;
        // Last heading that has crossed the top of the reading area wins.
        if (el.getBoundingClientRect().top <= 140) current = id;
      }
      setActive(current);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    /**
     * Release the hold — but only for input the reader generated. Programmatic
     * smooth scrolling fires plenty of scroll events and none of these, which
     * is exactly what keeps the highlight still until they take over.
     */
    const release = () => {
      if (!held.current) return;
      held.current = null;
      onScroll();
    };

    const onKey = (e: KeyboardEvent) => {
      if (SCROLL_KEYS.has(e.key)) release();
    };

    // Covers the "#" anchors in the prose too, and the back button between
    // two headings — both change the hash without going through onClick.
    const onHashChange = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!list.includes(id)) return;
      held.current = id;
      setActive(id);
    };

    // Landing on a deep link should highlight that section, not the first one.
    const initial = decodeURIComponent(window.location.hash.slice(1));
    if (initial && list.includes(initial)) {
      held.current = initial;
      setActive(initial);
    } else {
      measure();
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchmove", release, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("hashchange", onHashChange);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchmove", release);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [ids]);

  /**
   * Scroll to a heading ourselves instead of letting the hash do it.
   *
   * Two reasons. The animation stops depending on `scroll-behavior: smooth`
   * surviving on <html>, and pushState updates the URL without the hash
   * navigation that would fire a second, competing jump. `block: "start"`
   * still honours the headings' scroll-margin-top, so the target clears the
   * floating header exactly as it did before.
   */
  const jump = (id: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Leave modified clicks alone — open-in-new-tab still works.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const el = document.getElementById(id);
    if (!el) return;

    e.preventDefault();
    held.current = id;
    setActive(id);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    history.pushState(null, "", `#${id}`);
  };

  const list = (headings: Heading[], langClass: string) => (
    <ul className={langClass}>
      {headings.map((h) => (
        <li key={h.id} data-level={h.level}>
          <a
            href={`#${h.id}`}
            onClick={jump(h.id)}
            className={h.id === active ? "toc-link is-active" : "toc-link"}
          >
            {h.text}
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    // No visible "On this page" heading by design — the rail reads as an
    // outline on sight, and aria-label carries it for screen readers.
    <nav className="toc-rail" aria-label="Table of contents">
      {/* Without a translated body there's one outline, shown in both modes. */}
      {uk ? (
        <>
          {list(en, "lang-en")}
          {list(uk, "lang-uk")}
        </>
      ) : (
        list(en, "")
      )}
    </nav>
  );
}
