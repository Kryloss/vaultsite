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

  /** Follow the entry footer's prev/next link, if this page has one. */
  const sibling = useCallback(
    (which: "prev" | "next") => {
      const a = document.querySelector<HTMLAnchorElement>(`a.sibling-${which}`);
      const href = a?.getAttribute("href");
      if (href) router.push(href);
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
  }, [router, sibling, onSearch, toggleLang, sections]);

  const rows: { keys: string[]; label: { en: string; uk: string } }[] = [
    { keys: ["["], label: ui.previousEntry },
    { keys: ["]"], label: ui.nextEntry },
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
