"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import T from "@/components/T";
import { BookOpenIcon } from "@/components/icons";
import { ui } from "@/lib/ui-strings";

/**
 * Remembers how far into a long note you got, and offers to take you back.
 *
 * **It never scrolls on its own.** Restoring the position automatically is the
 * version of this feature everyone builds first and everyone regrets: you open
 * a link someone sent you, read two lines, and the page yanks you into the
 * middle of a paragraph you don't recognise. The offer is a small pill you can
 * ignore, and ignoring it costs nothing — it hides itself once you start
 * reading anyway.
 *
 * Deliberately quiet about when it appears at all:
 *
 * - only past `MIN_DEPTH` — being a screen and a half in is what makes a
 *   position worth remembering; anything less and you can find it by scrolling
 * - only when you arrive at the top, so it never argues with the browser's own
 *   scroll restoration on a back-navigation. Note that this is why the pill is
 *   rarer on a phone than on a desktop: mobile browsers restore scroll on
 *   reload and on back, and when they've already put you where you were there
 *   is nothing left to offer
 * - never when the URL carries a `#heading`, which is already an instruction
 *   about where to land
 * - never when the note has since become shorter than the saved position,
 *   which means it was edited and the offset is meaningless
 *
 * Storage is one localStorage key holding a map of path → { y, t }, pruned to
 * the most recent `KEEP` notes. A per-path key would leave a growing pile of
 * entries in the reader's browser that nothing ever cleans up.
 */

const KEY = "reading-positions";
/** Notes remembered at once. Oldest are dropped first. */
const KEEP = 20;
/** Forget a position after this long — you've lost the thread by then. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** Don't offer to restore anything shallower than this. */
const MIN_DEPTH = 1.5;
/**
 * Keys that mean "the reader is moving the page themselves" — the same set
 * components/Toc.tsx uses, and for the same reason: a scroll event says the
 * page moved, not who moved it.
 */
const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
]);

/**
 * Wait this long before deciding whether to offer.
 *
 * A browser restoring its own scroll position does it after the first frame,
 * and on mobile often several frames later — so the original one-rAF check
 * ran too early to see it. Nothing is visible yet either way: the pill's
 * entrance animation is delayed longer than this.
 */
const DECIDE_AFTER = 250;
/** Quiet time before the position is written — see `persist` below. */
const SAVE_DEBOUNCE = 400;

type Positions = Record<string, { y: number; t: number }>;

function read(): Positions {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Positions) : {};
  } catch {
    return {}; // private mode, quota, or somebody else's data in our key
  }
}

function write(positions: Positions) {
  try {
    const fresh = Date.now() - MAX_AGE_MS;
    const kept = Object.entries(positions)
      .filter(([, v]) => v.t > fresh)
      .sort((a, b) => b[1].t - a[1].t)
      .slice(0, KEEP);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    /* storage full or blocked — the feature simply doesn't remember */
  }
}

export default function ReadingPosition() {
  const pathname = usePathname();
  const [offer, setOffer] = useState<number | null>(null);
  /** Set once the reader has moved themselves, so the pill stops competing. */
  const moved = useRef(false);
  /**
   * `?rp=debug` prints why the offer was or wasn't made, on the page.
   *
   * This feature depends on four conditions and on data stored per ORIGIN, so
   * "it works locally but not in production" can mean the code is broken or
   * simply that nothing was ever saved on that domain — and the two look
   * identical from the outside. On a phone there's no console to settle it
   * with, so the panel exists to be read off the screen. Opt-in, so it costs
   * a normal visit nothing.
   */
  const [debug, setDebug] = useState<string[] | null>(null);

  const hide = useCallback(() => setOffer(null), []);

  useEffect(() => {
    moved.current = false;
    setOffer(null);

    const vh = document.documentElement.clientHeight;
    const saved = read()[pathname];
    const hasHash = window.location.hash.length > 1;

    /**
     * The position last observed. `persist` uses this rather than reading
     * `window.scrollY` when it runs, because it also runs on unmount — and on
     * an in-app navigation the router has already scrolled the window back to
     * the top by then. Reading live would have seen 0 and deleted the mark on
     * the way out of every note, so nothing was ever remembered.
     */
    let lastY = window.scrollY;

    /**
     * Whether this visit has produced a scroll at all. Nothing is written
     * without one — and crucially, nothing is DELETED without one either.
     *
     * `persist` runs on unmount, and React StrictMode (on by default in the
     * App Router's dev server) mounts every component, unmounts it, and mounts
     * it again. So arriving at a note ran the cleanup immediately, at
     * `scrollY: 0`, which read as "started again" and wiped the saved mark
     * before the offer could be made. In development the feature deleted its
     * own data on arrival, every single time.
     */
    let scrolled = false;

    /**
     * Deferred, not immediate: on a client-side navigation the router's own
     * scroll reset hasn't necessarily happened when this effect first runs, so
     * checking "did they arrive at the top" straight away can read the
     * *previous* page's position. A browser restoring its own scroll takes
     * longer still — see DECIDE_AFTER.
     */
    const decide = window.setTimeout(() => {
      lastY = window.scrollY;
      const pageHeight = document.documentElement.scrollHeight;
      const gates = {
        "has saved position": !!saved,
        "reader hasn't scrolled yet": !moved.current,
        "arrived near the top": window.scrollY < 100,
        "no #heading in the URL": !hasHash,
        "saved deeper than 1.5 screens": !!saved && saved.y > vh * MIN_DEPTH,
        "note still long enough": !!saved && saved.y < pageHeight - vh,
      };

      if (Object.values(gates).every(Boolean) && saved) setOffer(saved.y);

      if (new URLSearchParams(window.location.search).get("rp") === "debug") {
        setDebug([
          `origin ${window.location.origin}`,
          `path ${pathname}`,
          `saved ${saved ? `y=${Math.round(saved.y)}` : "— nothing stored for this path"}`,
          `keys ${Object.keys(read()).length}`,
          `scrollY ${Math.round(window.scrollY)} · vh ${vh} · page ${pageHeight}`,
          `needs y > ${Math.round(vh * MIN_DEPTH)}`,
          ...Object.entries(gates).map(([k, v]) => `${v ? "PASS" : "FAIL"} ${k}`),
        ]);
      }
    }, DECIDE_AFTER);

    /**
     * Saving is debounced, and separate from the scroll handler on purpose:
     * localStorage reads and writes are synchronous and JSON-parsing the map
     * on every animation frame is exactly the kind of thing that makes a page
     * feel heavy while scrolling. The position only has to be right when the
     * reader stops or leaves.
     */
    const persist = () => {
      if (!scrolled) return; // see `scrolled` above — a visit with no scroll
      const positions = read();
      // Near the top means "started again" — drop the mark rather than leaving
      // a stale one that offers to send them back two lines.
      if (lastY < vh * MIN_DEPTH) delete positions[pathname];
      else positions[pathname] = { y: lastY, t: Date.now() };
      write(positions);
    };

    let frame = 0;
    let save = 0;
    const onScroll = () => {
      scrolled = true;
      window.clearTimeout(save);
      save = window.setTimeout(persist, SAVE_DEBOUNCE);
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        lastY = window.scrollY;
      });
    };

    /**
     * The reader took over — withdraw the offer.
     *
     * This used to be "scrollY has passed 400px", which is a statement about
     * the page rather than the person, and a browser restoring its own scroll
     * position satisfies it instantly. On every mobile browser that meant the
     * pill was killed by the same restoration that made it worth showing, so
     * it never appeared on a phone at all. `wheel`, `touchmove` and the scroll
     * keys are all things a reader does; scroll restoration fires none of them.
     */
    const takeOver = () => {
      moved.current = true;
      setOffer(null);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setOffer(null);
      if (SCROLL_KEYS.has(e.key)) takeOver();
    };

    // A closed tab never fires the debounce. `pagehide` covers closing, a
    // back-navigation, and iOS putting the tab to sleep, which `beforeunload`
    // does not.
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", takeOver, { passive: true });
    window.addEventListener("touchmove", takeOver, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("pagehide", persist);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(decide);
      window.clearTimeout(save);
      // Leaving for another page in the app is a departure too.
      persist();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", takeOver);
      window.removeEventListener("touchmove", takeOver);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pagehide", persist);
    };
  }, [pathname]);

  /* Rendered before the early return below, so it shows whether or not the
     offer was made — the interesting case is usually that it wasn't. */
  const panel = debug ? (
    <div className="rp-debug">
      {debug.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  ) : null;

  if (offer === null) return panel;

  /**
   * One chip, built exactly like the mobile contents pill in Toc.tsx — same
   * rounded-full translucent material, same blur, same hover. It sits at the
   * bottom of the same column the contents rail occupies, so on a wide screen
   * the two read as one family of controls beside the article rather than two
   * unrelated things stuck to opposite corners of the window.
   *
   * No dismiss button: matching that pill means one control, and the offer
   * already withdraws itself the moment the reader scrolls under their own
   * steam. Escape closes it for anyone who wants it gone without moving.
   */
  return (
    <>
      {panel}
    <button
      type="button"
      onClick={() => {
        window.scrollTo({ top: offer, behavior: "smooth" });
        hide();
      }}
      onKeyDown={(e) => e.key === "Escape" && hide()}
      className="resume-reading"
    >
      <BookOpenIcon className="resume-reading-icon" />
      <span className="resume-reading-label">
        <T {...ui.resumeReading} />
      </span>
    </button>
    </>
  );
}
