"use client";

import { useEffect, useRef, useState } from "react";
import { CopyIcon, CheckIcon } from "@/components/icons";
import { useLang } from "@/components/useLang";
import { copyText } from "@/lib/clipboard";
import { ui } from "@/lib/ui-strings";

/**
 * Shared copy-the-note's-raw-markdown behaviour, used both by the button
 * below and by the title tap-target on phones (`CopyMarkdownTitle`).
 *
 * `copy()` writes the clipboard unconditionally on every call and reports
 * whether that write succeeded — nothing here tries to guess whether the
 * clipboard already held this text, because the only way to know is to
 * actually read it back (a permission prompt), and the system clipboard can
 * change from outside the page (another app, another tab) at any time. A
 * "skip the confirmation, this was already copied" shortcut would go stale
 * the moment that happened: the tap would silently re-copy but never say so.
 */
function useCopyMarkdown(en: string, uk?: string) {
  const { lang } = useLang();
  const [done, setDone] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    const source = lang === "uk" && uk ? uk : en;
    const trimmed = source.trim();
    if (!(await copyText(trimmed))) return false;
    setDone(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDone(false), 1600);
    return true;
  };

  const label = done ? ui.copiedCode[lang] : ui.copyMarkdown[lang];

  return { copy, done, label };
}

/**
 * Copies the note's raw markdown — the source as it exists in the vault, not
 * the rendered HTML. Follows the active language, so the Ukrainian body is
 * what you get with the site in Ukrainian.
 *
 * The markdown ships inline as props rather than being fetched: it's the same
 * text the page already renders, and the Cmd+K search index in every page is
 * larger than this by a wide margin.
 */
export default function CopyMarkdown({ en, uk }: { en: string; uk?: string }) {
  const { copy, done, label } = useCopyMarkdown(en, uk);

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      title={label}
      className="copy-md"
    >
      {done ? (
        <CheckIcon className="h-full w-full" />
      ) : (
        <CopyIcon className="h-full w-full" />
      )}
    </button>
  );
}

/**
 * Wraps the entry title so tapping it copies the markdown on phones, where
 * `.copy-md` has no room in the margin and there's no hover to reveal it
 * anyway. Desktop pointers keep using the button — this only intercepts the
 * tap on narrow/no-hover viewports, so a mouse click on the title (e.g. text
 * selection) is left alone.
 */
export function CopyMarkdownTitle({
  en,
  uk,
  children,
}: {
  en: string;
  uk?: string;
  children: React.ReactNode;
}) {
  const { copy } = useCopyMarkdown(en, uk);
  const { lang } = useLang();
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<number | undefined>(undefined);
  const textRef = useRef<HTMLSpanElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  /* Anchored to the end of the title's FIRST line specifically, not
     wherever the text happens to end — a title that wraps to two or three
     lines has nothing ABOVE line 1 to collide with, so pinning the badge
     there sidesteps the overlap a later line's tight leading can't spare
     room for. Measured with a Range rather than guessed in `em`s: the
     title's font-size is fluid and a translation wraps differently than
     its English original, so only the actual rendered line box is
     reliable. Same technique as the ToC's sliding marker — read the live
     DOM, don't compute it twice. */
  useEffect(() => {
    const textEl = textRef.current;
    const iconEl = iconRef.current;
    const title = textEl?.closest<HTMLElement>(".page-title");
    if (!textEl || !iconEl || !title) return;

    const place = () => {
      const range = document.createRange();
      range.selectNodeContents(textEl);
      // The hidden-language span contributes no rects (display: none), so
      // the first non-empty one is always line 1 of whichever language is
      // actually showing.
      const firstLine = Array.from(range.getClientRects()).find(
        (r) => r.width > 0 && r.height > 0
      );
      if (!firstLine) return;
      const titleRect = title.getBoundingClientRect();
      iconEl.style.setProperty("--x", `${firstLine.right - titleRect.left}px`);
      iconEl.style.setProperty("--y", `${firstLine.top - titleRect.top}px`);
    };

    place();
    // Fonts landing late change where the title wraps.
    const ro = new ResizeObserver(place);
    ro.observe(title);
    return () => ro.disconnect();
  }, [lang]);

  const onClick = async () => {
    if (!window.matchMedia("(max-width: 639px), (hover: none)").matches) return;
    if (!(await copy())) return;
    setFlash(true);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(false), 1200);
  };

  return (
    <span onClick={onClick} className="copy-md-title">
      <span ref={textRef}>{children}</span>
      {/* Positioned OUT of flow against the measured line-1 endpoint
          above, so tapping (opacity-only) never touches layout. Same
          plain checkmark the desktop button swaps to, not a filled badge
          — a confirmation on a phone shouldn't outweigh the one a mouse
          gets. */}
      <span ref={iconRef} className="copy-md-title-icon" aria-hidden="true" data-copied={flash || undefined}>
        <CheckIcon className="h-full w-full" />
      </span>
    </span>
  );
}
