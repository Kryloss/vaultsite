/**
 * The View Transitions API, with the guards every use of it needs.
 *
 * Browser-only and dependency-free, so both the navigation transitions
 * (components/PageTransitions.tsx) and the lightbox share one capability
 * check and one set of rules:
 *
 * - **Unsupported browsers do nothing extra.** Firefox has no
 *   `startViewTransition` yet, and this must never be the difference between
 *   a link working and not working.
 * - **`prefers-reduced-motion` opts out entirely.** A transition can't be
 *   shortened into nothing — it either animates or it doesn't — so the check
 *   belongs here rather than in a CSS override.
 */

type ViewTransition = { finished: Promise<void>; ready: Promise<void> };
type StartViewTransition = (callback: () => void | Promise<void>) => ViewTransition;

function api(): StartViewTransition | null {
  if (typeof document === "undefined") return null;
  const start = (document as unknown as { startViewTransition?: StartViewTransition })
    .startViewTransition;
  if (typeof start !== "function") return null;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  return start.bind(document) as StartViewTransition;
}

/** True when a transition would actually animate — check before intercepting. */
export function canTransition(): boolean {
  return api() !== null;
}

/**
 * Run `update` inside a view transition, or just run it.
 *
 * `update` may return a promise: the API holds the old frame on screen until
 * it settles, which is how an async route change gets to be a transition.
 * Returns the transition's `finished` promise so callers can clean up
 * temporary `view-transition-name`s once the animation is over.
 */
export function withViewTransition(update: () => void | Promise<void>): Promise<void> {
  const start = api();
  if (!start) return Promise.resolve(update()).then(() => {});
  try {
    return start(update).finished.catch(() => {});
  } catch {
    // A transition already running, or the document was hidden mid-call.
    return Promise.resolve(update()).then(() => {});
  }
}

/**
 * Give an element a transition name for the length of one transition, then
 * take it back. Names must be unique among rendered elements, so a name that
 * outlives its animation would break the next one — which is why this hands
 * back a cleanup rather than leaving it set.
 */
export function nameFor(el: Element | null | undefined, name: string): () => void {
  if (!(el instanceof HTMLElement)) return () => {};
  el.style.viewTransitionName = name;
  return () => {
    el.style.viewTransitionName = "";
  };
}
