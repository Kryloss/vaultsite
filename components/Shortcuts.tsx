"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import T from "@/components/T";
import { useLang } from "@/components/useLang";
import { ui } from "@/lib/ui-strings";
import type { NavItem } from "@/components/Chrome";

/**
 * Keyboard navigation, for readers who'd rather not reach for the mouse.
 *
 *   [ / ]   previous / next entry in this section
 *   j / k           down / up the list on this page
 *   g then h        home
 *   g then 1…9      the nth section, in sidebar order
 *   l               switch language
 *   /               open search
 *   ?               this list
 *
 * **Prev/next is read out of the DOM, not passed in as props.** The entry
 * footer (components/EntryFooter.tsx) already renders exactly these two links,
 * computed per page by lib/siblings.ts; this looks them up by class at the
 * moment the key is pressed. Threading the same two hrefs through the layout
 * as props would mean a second source of truth that can disagree with the
 * visible links — and this component is mounted globally, where that data
 * doesn't exist. Same event-delegation approach as Lightbox and CodeCopy.
 *
 * `g 1…9` uses digits rather than initials on purpose: Posts, People and
 * Projects all start with P, and any letter scheme either collides or needs a
 * hand-maintained table that goes stale the moment a section is added. The
 * numbers come from the nav order the sidebar already shows, and the cheat
 * sheet prints the real names beside them.
 */

/** How long a pressed `g` waits for its second key before giving up. */
const CHORD_MS = 1200;

/** Typing somewhere real — never steal the key. */
function isTyping(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.isContentEditable ||
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT"
  );
}

/**
 * Whether a modal is up — the drawer, the palette, this sheet.
 *
 * Read from the DOM rather than from state, exactly like the prev/next links
 * below: this component doesn't own the drawer or the palette and would have
 * to be handed their state to know, which is a second source of truth for
 * something the page already says out loud. Every dialog on the site is
 * `inert` when closed (Chrome, CommandPalette, and the sheet below all do
 * this), so "a dialog that isn't inert" is the whole test.
 */
function modalOpen(): boolean {
  return !!document.querySelector('[role="dialog"][aria-modal="true"]:not([inert])');
}

/**
 * The rows of whatever list is on this page, in reading order.
 *
 * `.stagger` is the hook, and it isn't a new one: every list on the site
 * already carries it so its children can arrive one at a time (DECISIONS #38),
 * which makes it the existing answer to "which elements here are a list".
 * Posts put one on each year, so a page can have several — querySelectorAll
 * returns them in document order, and flattening keeps the rows in the order
 * they're read.
 *
 * `offsetParent` skips the hidden language: both are in the HTML, and without
 * this a reader in Ukrainian would be walking the English list.
 */
function listRows(): HTMLAnchorElement[] {
  const rows: HTMLAnchorElement[] = [];
  for (const list of document.querySelectorAll<HTMLElement>(".stagger")) {
    if (list.offsetParent === null) continue;
    for (const child of list.children) {
      // The row is usually a wrapper (<li>, <article>) around one link, but the
      // shelf makes the card itself the link.
      const link =
        child instanceof HTMLAnchorElement
          ? child
          : child.querySelector<HTMLAnchorElement>("a[href]");
      if (link) rows.push(link);
    }
  }
  return rows;
}

export default function Shortcuts({
  items,
  onSearch,
}: {
  items: NavItem[];
  onSearch: () => void;
}) {
  const router = useRouter();
  const { lang, toggle: toggleLang } = useLang();
  const [sheet, setSheet] = useState(false);
  /** Contents wait for the first open — see the note in CommandPalette. */
  const [everOpen, setEverOpen] = useState(false);
  useEffect(() => {
    if (sheet) setEverOpen(true);
  }, [sheet]);

  /**
   * Sections in sidebar order, minus home — it has its own key.
   *
   * Memoized because the listener below depends on it: a fresh array each
   * render would tear down and re-add the handler, and a half-typed `g` chord
   * lives in that closure. It would be dropped every time anything re-rendered.
   */
  const sections = useMemo(
    () => items.filter((i) => i.slug !== "home").slice(0, 9),
    [items]
  );

  /**
   * Move the highlight down (`+1`) or up (`-1`) the page's list.
   *
   * The highlight IS focus — the row is focused rather than tracked in state
   * and painted to look focused. That's one line instead of a selected-index
   * and a scroll-into-view of our own, and it means Enter already opens the
   * row, Tab carries on from where you are, and a screen reader is told what
   * you're pointing at. The class only exists because a programmatic focus
   * isn't reliably `:focus-visible` across browsers, and a highlight you can't
   * see is no highlight.
   */
  const moveList = useCallback((delta: 1 | -1) => {
    const rows = listRows();
    if (rows.length === 0) return false;

    const here = rows.indexOf(document.activeElement as HTMLAnchorElement);
    // Starting fresh: `j` takes the first row, `k` the last, so both keys
    // enter the list from the end they travel away from.
    const next =
      here === -1
        ? delta === 1
          ? 0
          : rows.length - 1
        : Math.min(rows.length - 1, Math.max(0, here + delta));

    const row = rows[next];
    for (const other of rows) other.classList.remove("list-focus");
    row.classList.add("list-focus");
    row.addEventListener("blur", () => row.classList.remove("list-focus"), {
      once: true,
    });
    // preventScroll, then scroll deliberately: the browser's own focus scroll
    // jumps the row to the edge of the window, where `nearest` moves as little
    // as possible and leaves a row that's already visible where it is.
    row.focus({ preventScroll: true });
    row.scrollIntoView({
      block: "nearest",
      // Browsers don't apply the reduced-motion preference to programmatic
      // smooth scrolling — it has to be asked for and honoured here.
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
    return true;
  }, []);

  /**
   * Follow the entry footer's prev/next link, if this page has one.
   *
   * `.is-thrown` gives the keyboard the animation the pointer gets for free
   * from `:active` — the arrow flies off in the direction you sent it (see
   * globals.css). Without it, `]` and clicking "next" would do the same thing
   * and feel like different sites. The navigation unmounts the link, which is
   * the real cleanup — the timer only matters for a press that doesn't
   * navigate, and is long enough not to snap the arrow back mid-flight (same
   * reasoning as components/ArrowThrow.tsx).
   */
  const sibling = useCallback(
    (which: "prev" | "next") => {
      const a = document.querySelector<HTMLAnchorElement>(`a.sibling-${which}`);
      const href = a?.getAttribute("href");
      if (!href) return;
      a?.classList.add("is-thrown");
      window.setTimeout(() => a?.classList.remove("is-thrown"), 1500);
      router.push(href);
    },
    [router]
  );

  useEffect(() => {
    /** Set when `g` is pressed, cleared on the next key or on timeout. */
    let chord = false;
    let timer = 0;

    const endChord = () => {
      chord = false;
      window.clearTimeout(timer);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;

      // Unconditional rather than `if (sheet)`, so the handler never has to
      // read that state — see the note on `sections` above. Closing an already
      // closed sheet is a no-op, and Chrome's own Escape listener still runs.
      if (e.key === "Escape") {
        setSheet(false);
        return;
      }
      // Any other key while the sheet is up should close it and still act.
      if (chord) {
        endChord();
        if (e.key === "h") {
          e.preventDefault();
          setSheet(false);
          router.push("/");
          return;
        }
        const n = Number(e.key);
        if (n >= 1 && n <= sections.length) {
          e.preventDefault();
          setSheet(false);
          router.push(`/${sections[n - 1].slug}`);
        }
        return;
      }

      switch (e.key) {
        case "g":
          chord = true;
          timer = window.setTimeout(endChord, CHORD_MS);
          return;
        case "[":
          e.preventDefault();
          sibling("prev");
          return;
        case "]":
          e.preventDefault();
          sibling("next");
          return;
        case "j":
        case "k":
          // Only when a list is actually being walked. On a note there's
          // nothing to move through, and swallowing the key there would break
          // Vim-style scrolling for anyone whose browser extension provides
          // it — moveList reports whether it found a list at all.
          if (modalOpen()) return;
          if (moveList(e.key === "j" ? 1 : -1)) e.preventDefault();
          return;
        case "l":
          e.preventDefault();
          toggleLang();
          return;
        case "/":
          e.preventDefault();
          setSheet(false);
          onSearch();
          return;
        case "?":
          e.preventDefault();
          setSheet((v) => !v);
          return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, [router, sibling, moveList, onSearch, toggleLang, sections]);

  const rows: { keys: string[]; label: { en: string; uk: string } }[] = [
    { keys: ["["], label: ui.previousEntry },
    { keys: ["]"], label: ui.nextEntry },
    { keys: ["j"], label: ui.shortcutListDown },
    { keys: ["k"], label: ui.shortcutListUp },
    { keys: ["g", "h"], label: ui.shortcutHome },
    ...sections.map((s, i) => ({
      keys: ["g", String(i + 1)],
      label: { en: s.title, uk: s.titleUk ?? s.title },
    })),
    { keys: ["l"], label: ui.actionToggleLang },
    { keys: ["/"], label: ui.shortcutSearch },
    { keys: ["?"], label: ui.shortcutSheet },
  ];

  return (
    /* Always rendered, shown by `data-open` — same reasoning as the palette. */
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ui.shortcutSheet[lang]}
      data-open={sheet}
      inert={!sheet}
      onClick={() => setSheet(false)}
      className="overlay fixed inset-0 z-[65] flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="overlay-panel w-full max-w-xs overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-2xl"
      >
        {everOpen && (
          <>
        <p className="border-b border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--text)]">
          <T {...ui.shortcutSheet} />
        </p>
        <ul className="py-1.5">
          {rows.map((row) => (
            <li
              key={row.keys.join()}
              className="flex items-center justify-between gap-4 px-4 py-1.5 text-sm text-[var(--text-secondary)]"
            >
              <span className="truncate">
                <T {...row.label} />
              </span>
              <span className="flex shrink-0 gap-1">
                {row.keys.map((k) => (
                  <kbd key={k} className="shortcut-key">
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
          </>
        )}
      </div>
    </div>
  );
}
