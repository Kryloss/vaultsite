"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Makes a thrown arrow stay thrown.
 *
 * The animation itself is CSS (see `.sibling-arrow` / `.arrow-glyph` in
 * globals.css): the arrow leads on hover and flies off in the direction it
 * points while the control is held. The problem is that `:active` ends the
 * moment the finger lifts — which is a fraction of a second BEFORE the next
 * page paints — so the arrow raced back to its resting position and then the
 * page changed. The gesture read as "cancelled" rather than "sent".
 *
 * CSS can't fix that on its own. `:active` is the only selector for "being
 * pressed" and there is no state after it to hold; an animation with
 * `forwards` is dropped along with the selector that started it. So one class
 * is added at the click and never removed: the navigation unmounts the link,
 * and the arrow's last frame is the one on screen while the new page arrives.
 *
 * Delegated from the document, like components/CodeCopy.tsx and
 * components/Lightbox.tsx — these links are rendered by server components all
 * over the site, and threading a click handler into each of them would mean
 * making them all client components for one class name.
 *
 * `Shortcuts` adds the same class for `[` and `]`, so the keyboard and the
 * pointer end up in the same state by different routes.
 */

/**
 * How long a thrown arrow waits before giving up and coming back.
 *
 * Only reached when the click DIDN'T navigate — a link to the page you're
 * already on, a route that failed. Long enough that a normal navigation
 * unmounts the link first (which is the real cleanup), short enough that a
 * page left standing doesn't keep a missing arrow for ever.
 */
const GIVE_UP_MS = 1500;

export default function ArrowThrow() {
  const pathname = usePathname();

  /* A new page shouldn't inherit the last one's thrown arrows. Nothing
     normally survives the navigation to need this — it's here for the back
     button, which can restore a page from the bfcache exactly as it was left,
     mid-throw. */
  useEffect(() => {
    for (const el of document.querySelectorAll(".is-thrown")) {
      el.classList.remove("is-thrown");
    }
  }, [pathname]);

  useEffect(() => {
    const timers: number[] = [];

    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      // Modified clicks open a new tab and leave this page exactly as it is,
      // so the arrow must not fly away from a page that isn't going anywhere.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const link = e.target.closest<HTMLElement>("a.sibling, a.action-link");
      if (!link) return;
      link.classList.add("is-thrown");
      timers.push(
        window.setTimeout(() => link.classList.remove("is-thrown"), GIVE_UP_MS)
      );
    };

    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      for (const t of timers) window.clearTimeout(t);
    };
  }, []);

  return null;
}
