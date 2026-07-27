"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { copyText } from "@/lib/clipboard";
import { ui } from "@/lib/ui-strings";
import T from "./T";

/**
 * Select a passage in a note and copy a link that lands on it — a URL carrying
 * a **text fragment** (`#:~:text=…`), which the browser scrolls to and
 * highlights on arrival.
 *
 * Why a text fragment and not an id: this site is fully static (DECISIONS.md
 * #5) and the vault has no notion of a stable per-sentence anchor. A fragment
 * is derived from the words themselves, needs nothing stored anywhere, and
 * degrades to a plain link to the page in browsers that don't support it
 * (Firefox, at the time of writing). Nothing to maintain, nothing to break
 * when the note is edited — the link just stops highlighting.
 *
 * Pointer devices only, same as components/LinkPreview.tsx: a touch selection
 * already raises the OS's own share sheet and a second floating button on top
 * of it is a fight nobody wins.
 */

/** Words kept at each end before a long selection is split into start,end. */
const CONTEXT_WORDS = 5;
/** Above this many words, link the ends instead of the whole passage. */
const SPLIT_ABOVE = 12;
/** URLs beyond this are unusable in most chat apps — fall back to plain. */
const MAX_URL = 900;
const PILL_HEIGHT = 34;
const MARGIN = 8;

/**
 * Percent-encode a fragment part. `-`, `,` and `&` are the syntax of the
 * directive itself; encodeURIComponent already handles the last two, but
 * leaves the hyphen alone — an unescaped one would be read as the boundary
 * between a prefix and its match.
 */
function encodePart(s: string): string {
  return encodeURIComponent(s).replace(/-/g, "%2D");
}

/** Build `#:~:text=…` for a selection, splitting long ones into start,end. */
function textFragment(raw: string): string | null {
  const text = raw.replace(/\s+/g, " ").trim();
  if (text.length < 2) return null;

  const words = text.split(" ");
  const directive =
    words.length > SPLIT_ABOVE
      ? `${encodePart(words.slice(0, CONTEXT_WORDS).join(" "))},${encodePart(
          words.slice(-CONTEXT_WORDS).join(" ")
        )}`
      : encodePart(text);

  return `#:~:text=${directive}`;
}

export default function SelectionLink() {
  const pathname = usePathname();
  const [pill, setPill] = useState<{ left: number; top: number } | null>(null);
  const [copied, setCopied] = useState(false);
  /** The normalized selection captured when the pill was shown. */
  const text = useRef("");
  const resetTimer = useRef<number | undefined>(undefined);

  const hide = useCallback(() => {
    setPill(null);
    setCopied(false);
  }, []);

  useEffect(() => hide(), [pathname, hide]);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    /** Only offer this for prose — not for nav labels or a heading in a list. */
    const inProse = (node: Node | null): boolean => {
      const el = node instanceof Element ? node : node?.parentElement;
      return !!el?.closest(".prose");
    };

    const check = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return hide();
      if (!inProse(sel.anchorNode) || !inProse(sel.focusNode)) return hide();

      const value = sel.toString().replace(/\s+/g, " ").trim();
      if (value.length < 2) return hide();

      const r = sel.getRangeAt(0).getBoundingClientRect();
      if (!r.width && !r.height) return hide();

      text.current = value;
      setCopied(false);
      // Centered above the selection, clamped to the viewport.
      setPill({
        left: Math.min(Math.max(r.left + r.width / 2, 80), window.innerWidth - 80),
        top:
          r.top > PILL_HEIGHT + MARGIN
            ? r.top - PILL_HEIGHT - MARGIN
            : r.bottom + MARGIN,
      });
    };

    // Selection is read after the gesture ends, never during: mid-drag the
    // range is still growing and the pill would chase the cursor.
    const onUp = () => window.setTimeout(check, 0);
    const onDown = (e: MouseEvent) => {
      // A click on the pill itself must not clear it before it fires.
      if (e.target instanceof Element && e.target.closest(".selection-pill")) return;
      hide();
    };

    document.addEventListener("mouseup", onUp);
    document.addEventListener("keyup", onUp);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", hide, { passive: true });
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("keyup", onUp);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", hide);
      window.removeEventListener("resize", hide);
      window.clearTimeout(resetTimer.current);
    };
  }, [hide]);

  const copy = async () => {
    const frag = textFragment(text.current);
    // The reader's language is a client-side preference (components/T.tsx), so
    // it has to ride along in the URL: a text fragment can only match text the
    // browser is actually showing, and the other language is sitting in the
    // same document under `display: none`. app/layout.tsx's pre-paint script
    // reads the param, so the right language is up before the match runs.
    //
    // ALWAYS written, including `?lang=en`. Leaving it off for English looks
    // tidier but breaks the link for anyone whose own stored preference is
    // Ukrainian — their setting would win, the page would come up in Ukrainian,
    // and the English fragment would match nothing. A shared link has to pin
    // the language it was written in, not inherit the reader's.
    const lang = document.documentElement.dataset.lang === "uk" ? "uk" : "en";
    const base = `${location.origin}${location.pathname}?lang=${lang}`;
    const url = frag && base.length + frag.length <= MAX_URL ? base + frag : base;

    if (await copyText(url)) {
      setCopied(true);
      window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(hide, 1400);
    }
  };

  if (!pill) return null;

  return (
    <button
      type="button"
      onClick={copy}
      className="selection-pill"
      style={{ left: pill.left, top: pill.top }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {copied ? (
          <path
            d="M20 6L9 17l-5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <T {...(copied ? ui.linkCopied : ui.copyLinkToSelection)} />
    </button>
  );
}
