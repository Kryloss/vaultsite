"use client";

import { useEffect, useRef, useState } from "react";
import T from "@/components/T";
import { useLang } from "@/components/useLang";
import { MenuIcon } from "@/components/icons";
import { activeHeading } from "@/lib/toc-spy";
import type { Heading } from "@/lib/toc";

/**
 * Table of contents, in two presentations driven by one piece of state:
 *
 * - **Wide screens** — a fixed rail to the right of the article.
 * - **Narrow screens** — a floating pill at the bottom, built like the
 *   breadcrumb bar in Chrome.tsx: same rounded-full blurred chip, an icon
 *   button, and truncated text saying where you are. Tapping it opens the
 *   outline. The rail has no room to exist below 1168px — the width its own
 *   geometry needs, derived in `globals.css` — which is exactly where a long
 *   post needs it most.
 *
 * Bilingual like everything else: both outlines ship in the HTML and CSS shows
 * the active one. The scroll-spy walks the merged list and skips anything whose
 * language is currently hidden — a display:none heading has no offsetParent, so
 * the check costs nothing and keeps one observer serving both languages.
 *
 * Which row is active is decided by `lib/toc-spy.ts`: the last heading above a
 * reading line that rests below the chrome and descends to the foot of the
 * window over the page's final screenful, so the closing sections can reach it.
 *
 * Jumping to a heading pins the highlight to it (see `held` below).
 */

/**
 * Longest label the phone pill shows before truncating. `.toc-bar` has no
 * fixed width to speak of — just a `max-width` cap — so an untruncated
 * heading or title wrapped inside it across two or three lines instead of
 * eliding; this cuts the string itself rather than leaning on CSS
 * `text-overflow`, so the pill stays the one-line chip it was built as
 * regardless of font metrics. Same word-boundary convention as the excerpt
 * cut in `lib/previews.ts` — cutting mid-word reads as broken, not trimmed.
 */
const LABEL_CHARS = 32;

function truncateLabel(text: string): string {
  if (text.length <= LABEL_CHARS) return text;
  const cut = text.slice(0, LABEL_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 12 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

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

export default function Toc({
  title,
  titleUk,
  en,
  uk,
}: {
  /** The note's own title — the first row, and the jump-to-top target. */
  title: string;
  titleUk?: string;
  en: Heading[];
  uk?: Heading[];
}) {
  const { lang } = useLang();
  const [active, setActive] = useState("");
  const [open, setOpen] = useState(false);
  /** The sheet's contents wait for the first open — see the note below. */
  const [everOpen, setEverOpen] = useState(false);
  /**
   * The heading the reader jumped to, held until they scroll again.
   *
   * Without this the spy overrules the click: it highlights whatever the
   * reading line has last passed, and a click that lands the page at its
   * bottom — anything in the final screenful — puts several headings above
   * that line at once, so the LAST of them wins rather than the one you asked
   * for. Smooth scrolling makes it worse, since the spy runs through every
   * heading on the way down.
   *
   * `""` is a real value meaning "pinned to the top of the page"; only `null`
   * means nothing is held.
   */
  const held = useRef<string | null>(null);
  const railRef = useRef<HTMLElement>(null);
  const ids = [...en, ...(uk ?? [])].map((h) => h.id).join(",");

  useEffect(() => {
    const list = ids.split(",").filter(Boolean);
    let frame = 0;

    const measure = () => {
      frame = 0;
      if (held.current !== null) return;
      const visible: string[] = [];
      const tops: number[] = [];
      for (const id of list) {
        const el = document.getElementById(id);
        // offsetParent is null for the hidden language's headings.
        if (!el || el.offsetParent === null) continue;
        visible.push(id);
        tops.push(el.getBoundingClientRect().top);
      }
      // The last heading above the reading line wins, and the line descends to
      // the foot of the window over the final screenful — otherwise the last
      // sections of a page can never reach it. See lib/toc-spy.ts.
      const i = activeHeading(tops, {
        scrollY: window.scrollY,
        innerHeight: window.innerHeight,
        scrollHeight: document.documentElement.scrollHeight,
      });
      setActive(i === -1 ? "" : visible[i]);
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
      if (held.current === null) return;
      held.current = null;
      onScroll();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
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
   *
   * Deliberately animates even under `prefers-reduced-motion` (owner's call):
   * the rest of the site still honours that setting — `html` drops to
   * `scroll-behavior: auto` and `.page-in` stops animating — so this is the
   * one interaction that overrides it. The travel is what shows where in the
   * page you landed; without it the jump reads as a page swap.
   */
  const jump = (id: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Leave modified clicks alone — open-in-new-tab still works.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const el = document.getElementById(id);
    if (!el) return;

    e.preventDefault();
    held.current = id;
    setActive(id);
    setOpen(false);

    el.scrollIntoView({ behavior: "smooth", block: "start" });
    history.pushState(null, "", `#${id}`);
  };

  /**
   * The title row behaves like the heading links, but its target is the top of
   * the page rather than an element. `href="#"` means the same thing without
   * JavaScript, so the fallback is correct rather than dead.
   */
  const jumpTop = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    held.current = "";
    setActive("");
    setOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Drop any lingering #heading so a reload lands at the top too.
    history.pushState(null, "", location.pathname + location.search);
  };

  /**
   * Move the rail's marker onto whichever row is active.
   *
   * Measured from the DOM rather than computed from the heading list: the two
   * languages' outlines are both in the rail with one of them `display: none`,
   * rows wrap to two lines at some titles, and the rail itself scrolls. The
   * live element's own `offsetTop` already accounts for all of that.
   *
   * Runs after paint on `active` and `lang`, which is exactly when the target
   * row can have moved. The height is set as well as the offset so the marker
   * matches a two-line row.
   */
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const place = () => {
      const marker = rail.querySelector<HTMLElement>(".toc-marker");
      if (!marker) return;
      // BOTH outlines are in the rail and both mark the same heading active,
      // so take the first one that is actually laid out — a display:none row
      // has no offsetParent, and matching it would park the marker at 0.
      const current = Array.from(
        rail.querySelectorAll<HTMLElement>("a.toc-link.is-active")
      ).find((el) => el.offsetParent !== null);
      // Nothing active: fade out where it is rather than jumping to the top.
      if (!current) {
        marker.style.opacity = "0";
        return;
      }
      marker.style.setProperty("--y", `${current.offsetTop}px`);
      marker.style.setProperty("--h", `${current.offsetHeight}px`);
      marker.style.opacity = "1";
    };

    place();
    // Fonts landing late change row heights under the marker.
    const ro = new ResizeObserver(place);
    ro.observe(rail);
    return () => ro.disconnect();
  }, [active, lang]);

  useEffect(() => {
    if (open) setEverOpen(true);
  }, [open]);

  const localTitle = lang === "uk" && titleUk ? titleUk : title;

  /** Text for the pill: the section you're in, or the note title at the top. */
  const hereLabel =
    [...en, ...(uk ?? [])].find((h) => h.id === active)?.text ?? localTitle;

  const topLink = (extra = "") => (
    <a
      href="#"
      onClick={jumpTop}
      /* Every row is truncated to one line — the tooltip carries the rest. */
      title={localTitle}
      className={`toc-link toc-top${extra}${active === "" ? " is-active" : ""}`}
    >
      <T en={title} uk={titleUk} />
    </a>
  );

  const list = (headings: Heading[], langClass: string) => (
    /* lang="uk" so a screen reader doesn't read Cyrillic headings with an
       English voice — see the note in components/T.tsx. */
    <ul className={langClass} lang={langClass === "lang-uk" ? "uk" : undefined}>
      {headings.map((h) => (
        <li key={h.id} data-level={h.level}>
          <a
            href={`#${h.id}`}
            onClick={jump(h.id)}
            /* Rows are one line and ellipsised — the tooltip is where a long
               heading's full text still lives, same as the title row. */
            title={h.text}
            className={h.id === active ? "toc-link is-active" : "toc-link"}
          >
            {h.text}
          </a>
        </li>
      ))}
    </ul>
  );

  const outline = (
    <>
      {/* Without a translated body there's one outline, shown in both modes. */}
      {uk ? (
        <>
          {list(en, "lang-en")}
          {list(uk, "lang-uk")}
        </>
      ) : (
        list(en, "")
      )}
    </>
  );

  return (
    <>
      <nav ref={railRef} className="toc-rail" aria-label="Table of contents">
        {/* One marker that slides between rows, rather than a border switching
            on and off per link. The rail is a fixed element, so this absolutely
            positioned span is measured against it and scrolls with its content.
            Hidden until it has been positioned once — see the effect below. */}
        <span className="toc-marker" aria-hidden />
        {/* The note's title as the first row of the outline — jumps to the top,
            and highlights whenever you're above the first heading. Rendered
            here only: it is NOT in the Cmd+K index, which already has this
            page as its own result. */}
        {topLink()}
        {outline}
      </nav>

      {/* Narrow screens: the same outline behind a breadcrumb-style pill.
          On a phone it is just the three-line icon, in the top-right corner
          and sized to match the floating bar opposite it; the label is hidden
          there and the sheet hangs underneath. Above that width the label is
          the whole control and the icon is hidden, as it always was. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={lang === "uk" ? "Зміст сторінки" : "Table of contents"}
        /* Full text on hover/long-press — the label itself is cut short. */
        title={hereLabel}
        className="toc-bar"
      >
        <MenuIcon className="toc-bar-icon" />
        <span className="toc-bar-label">{truncateLabel(hereLabel)}</span>
      </button>

      {/* Always rendered, shown by `data-open`, rather than mounted on demand:
          an element React has already removed can't animate on the way out, so
          conditional rendering can only ever blink. `inert` keeps the closed
          sheet away from the keyboard and from screen readers. */}
      <div
        className="toc-sheet-backdrop"
        data-open={open}
        aria-hidden
        onClick={() => setOpen(false)}
      />
      <nav
        className="toc-sheet"
        data-open={open}
        inert={!open}
        aria-label="Table of contents"
      >
        {/* A third copy of the outline in every page's HTML, for a panel most
            readers never open — so it waits for the first tap, then stays so
            it can animate shut. */}
        {everOpen && (
          <>
            {topLink(" toc-sheet-top")}
            {outline}
          </>
        )}
      </nav>
    </>
  );
}
