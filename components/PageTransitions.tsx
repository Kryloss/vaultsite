"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { canTransition, nameFor, withViewTransition } from "@/lib/view-transition";

/**
 * Page changes animate, and they know which way they're going.
 *
 * Next navigates on the client, so there is no document swap for the browser's
 * own cross-document transitions to hook into. Instead this intercepts the
 * click, starts a transition, and hands the API a promise that settles when
 * the new route has actually rendered — which is what lets an asynchronous
 * route change behave like one.
 *
 * **It only intercepts when it can do better.** Without `startViewTransition`,
 * or under `prefers-reduced-motion`, the listener returns immediately and
 * Next's own `<Link>` handles the click exactly as before. A missing animation
 * must never become a missing navigation.
 *
 * **Direction comes from how you moved.** A link is forward; `popstate` is
 * back. `data-nav` on `<html>` picks which keyframes run, so the page leaves
 * the way you came in — see `::view-transition` in globals.css.
 *
 * **The title carries across.** A list row's title and the entry's `<h1>` are
 * the same words, so they get the same transition name for the length of the
 * animation and the browser tweens between them instead of dissolving one and
 * building the other. Rows opt in with `data-vt-title`; the name is removed
 * afterwards, since two elements may never share one.
 */

/**
 * Longest the outgoing frame is held while waiting for the new route.
 *
 * The transition freezes the page until its callback settles, so this is the
 * worst thing a slow render can do to a reader. Pages are static and
 * prefetched, so it should never be reached — it exists so that if a render
 * never lands, the site unfreezes and carries on.
 */
const RENDER_TIMEOUT = 700;

/** Left click, no modifiers, not a new tab or a download. */
function isPlainClick(e: MouseEvent): boolean {
  return (
    e.button === 0 &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.shiftKey &&
    !e.altKey &&
    !e.defaultPrevented
  );
}

/** The path this anchor goes to, or null if it isn't ours to animate. */
function internalPath(a: HTMLAnchorElement): string | null {
  if (a.target && a.target !== "_self") return null;
  if (a.hasAttribute("download")) return null;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  // Same page: an in-document anchor scrolls, it doesn't navigate.
  if (url.pathname === window.location.pathname && url.search === window.location.search) {
    return null;
  }
  return url.pathname + url.search;
}

export default function PageTransitions() {
  const router = useRouter();
  const pathname = usePathname();
  /** Resolves the transition's callback once the new route has rendered. */
  const pending = useRef<(() => void) | null>(null);

  // The new route is on screen — let the held frame go.
  useEffect(() => {
    pending.current?.();
    pending.current = null;
  }, [pathname]);

  useEffect(() => {
    if (!canTransition()) return;

    const root = document.documentElement;
    /* Tells globals.css to stand down the CSS-only `.page-in` fade, which is
       the fallback for browsers that got this far and stopped. Both running
       would animate the page twice. */
    root.dataset.vt = "on";

    /** A promise that settles when the route changes, or when we give up. */
    const rendered = () =>
      new Promise<void>((resolve) => {
        const done = () => {
          window.clearTimeout(timer);
          pending.current = null;
          resolve();
        };
        const timer = window.setTimeout(done, RENDER_TIMEOUT);
        pending.current = done;
      });

    const onClick = (e: MouseEvent) => {
      if (!isPlainClick(e)) return;
      // A shelf row is mid-drag and about to swallow this click itself —
      // see components/lists/ShelfRow.tsx.
      if (root.dataset.rowDrag) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      const a = target.closest("a");
      if (!(a instanceof HTMLAnchorElement)) return;
      const href = internalPath(a);
      if (!href) return;

      // Ahead of React's delegated handler, so Next's Link never sees it.
      e.preventDefault();
      e.stopPropagation();

      root.dataset.nav = "forward";
      const release = nameFor(a.querySelector("[data-vt-title]"), "entry-title");

      void withViewTransition(() => {
        // The promise is armed BEFORE the push, so a render that lands
        // immediately can't finish before anything is listening for it.
        const done = rendered();
        router.push(href);
        return done;
      }).then(release);
    };

    /**
     * Back and forward buttons. The URL has already changed by the time this
     * runs, but React hasn't re-rendered yet — so the snapshot the API takes
     * here is still the old page, which is exactly what it needs.
     */
    const onPopState = () => {
      root.dataset.nav = "back";
      void withViewTransition(rendered);
    };

    document.addEventListener("click", onClick, { capture: true });
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("popstate", onPopState);
      delete root.dataset.vt;
    };
  }, [router]);

  return null;
}
