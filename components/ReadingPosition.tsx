"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import T from "@/components/T";
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
 *   scroll restoration on a back-navigation
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
/** Stop offering once the reader has scrolled this far under their own steam. */
const DISMISS_AFTER = 400;
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
     * Deferred a frame: on a client-side navigation the router's own scroll
     * reset hasn't necessarily happened when this effect first runs, so
     * checking "did they arrive at the top" immediately can read the *previous*
     * page's scroll position and silently decline to offer.
     */
    const decide = requestAnimationFrame(() => {
      lastY = window.scrollY;
      if (
        saved &&
        !moved.current &&
        window.scrollY < 100 &&
        !hasHash &&
        saved.y > vh * MIN_DEPTH &&
        // The note may have been rewritten shorter since the visit.
        saved.y < document.documentElement.scrollHeight - vh
      ) {
        setOffer(saved.y);
      }
    });

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
        if (lastY > DISMISS_AFTER) {
          moved.current = true;
          setOffer(null);
        }
      });
    };

    // A closed tab never fires the debounce. `pagehide` covers closing, a
    // back-navigation, and iOS putting the tab to sleep, which `beforeunload`
    // does not.
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", persist);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      cancelAnimationFrame(decide);
      window.clearTimeout(save);
      // Leaving for another page in the app is a departure too.
      persist();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", persist);
    };
  }, [pathname]);

  if (offer === null) return null;

  return (
    <div className="resume-reading">
      <button
        type="button"
        onClick={() => {
          window.scrollTo({ top: offer, behavior: "smooth" });
          hide();
        }}
        className="resume-reading-go"
      >
        <T {...ui.resumeReading} />
      </button>
      <button
        type="button"
        onClick={hide}
        aria-label={ui.dismiss.en}
        className="resume-reading-close"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M18 6 6 18M6 6l12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
