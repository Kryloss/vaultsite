"use client";

import { useEffect } from "react";
import { tidyCut } from "@/lib/tidy-cut";

/**
 * Makes a shortened line end "…a year…" instead of "…a year, …".
 *
 * Anything marked `data-tidy` is text the CSS already shortens, to one line
 * (`truncate`) or to a few (`-webkit-line-clamp`). The browser cuts wherever
 * the room runs out, which on a phone is often straight after a comma or a
 * space. CSS cannot move that cut, so when one of these overflows this
 * component shortens the text itself — to the longest whole-word cut that
 * fits, with the punctuation and the space taken off the end
 * (lib/tidy-cut.ts). Text that fits is never touched, and the CSS rule stays
 * as the fallback for a page without script. DECISIONS #217.
 *
 * Delegated from the document, like components/ArrowThrow.tsx: the marked
 * elements are rendered by server components all over the site.
 *
 * A marked element must hold only text, or a `<T>` pair of it. Anything else
 * (a chip, a link) is left to the CSS.
 */

/** The text nodes this has shortened, and what they said before. */
const originals = new Map<Text, string>();

/** Elements already looked at since the last reset. */
let seen = new WeakSet<HTMLElement>();

function overflows(el: HTMLElement): boolean {
  return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
}

/** The one text node on show: the element's own, or its visible language's. */
function shownText(el: HTMLElement): Text | null {
  const pair = el.querySelectorAll<HTMLElement>(":scope > .lang-en, :scope > .lang-uk");
  for (const holder of pair.length ? [...pair] : [el]) {
    if (holder.getClientRects().length === 0) continue;
    const node = holder.childNodes.length === 1 ? holder.firstChild : null;
    return node instanceof Text ? node : null;
  }
  return null;
}

function tidy(el: HTMLElement) {
  if (!overflows(el)) return;
  const node = shownText(el);
  if (!node) return;
  const full = node.data;
  // Longest cut that fits. Fit only gets worse as the cut grows, so bisect.
  let lo = 0;
  let hi = full.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    node.data = tidyCut(full, mid);
    if (overflows(el)) hi = mid - 1;
    else lo = mid;
  }
  node.data = tidyCut(full, lo);
  originals.set(node, full);
}

/** Only what has appeared since: new rows after a navigation or a filter. */
function scan() {
  for (const el of document.querySelectorAll<HTMLElement>("[data-tidy]")) {
    if (seen.has(el)) continue;
    seen.add(el);
    tidy(el);
  }
}

/** Start again from the full text: the width, or the language, has changed. */
function reset() {
  for (const [node, full] of originals) {
    if (node.isConnected) node.data = full;
  }
  originals.clear();
  seen = new WeakSet();
  scan();
}

export default function ClampTidy() {
  useEffect(() => {
    let timer = 0;
    let full = false;
    const schedule = (everything: boolean) => {
      full ||= everything;
      // A timer, not a frame: a tab opened in the background gets no frames,
      // and would show the browser's cut until it was looked at.
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (full) reset();
        else scan();
        full = false;
      }, 30);
    };

    schedule(true);
    // A late web font changes every measurement.
    document.fonts?.ready.then(() => schedule(true)).catch(() => {});

    // Width only: a phone fires `resize` every time its address bar hides.
    let width = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      schedule(true);
    };
    window.addEventListener("resize", onResize);

    // Our own edits are `characterData`, which neither observer watches, so
    // this cannot loop.
    const added = new MutationObserver(() => schedule(false));
    added.observe(document.body, { childList: true, subtree: true });
    const lang = new MutationObserver(() => schedule(true));
    lang.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-lang"],
    });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      added.disconnect();
      lang.disconnect();
    };
  }, []);

  return null;
}
