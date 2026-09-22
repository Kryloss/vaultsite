/**
 * Starts the icon gestures: the sidebar sections, the menu button, search,
 * the language flag, the music pill, mail, and the dev-tools pen.
 *
 * An element opts in with `data-icon-motion`; its icon's moving parts carry
 * `ic-*` classes (components/icons.tsx). The CSS keys every gesture on
 * `.icon-live` on that host, not on `:hover`, because a hover-tied animation
 * is dropped the instant the pointer leaves and the icon jumps back to rest.
 *
 * A gesture ALWAYS FINISHES. Leaving the host doesn't take the class off; it
 * waits for the host's running `ic-*` animations to end, and only then
 * releases it. Every keyframe ends where it began, so the release is
 * invisible. Coming back while it is still playing just lets it carry on.
 *
 * Listened for once, on the document (`useIconMotion`, mounted by Chrome),
 * rather than by props on each host: `SocialLinks` renders in server
 * components too, and a server component can't take an event handler — an
 * attribute it can. See `docs/CHROME.md` → Motion, #173.
 */
import { useEffect } from "react";
import { controlIconMotion, sectionIconMotion } from "@/lib/site-config";

const LIVE = "icon-live";
const HOST = "[data-icon-motion]";

/** Hosts that have been left and are waiting for their gesture to end. */
const leaving = new WeakSet<Element>();

export function iconEnter(host: Element) {
  leaving.delete(host);
  host.classList.add(LIVE);
}

export function iconLeave(host: Element) {
  if (!host.classList.contains(LIVE)) return;
  leaving.add(host);
  // Only the gestures: a host may hold other animations of its own (a
  // colour transition, a pulsing dot) that must not keep the class on.
  const gestures = host
    .getAnimations({ subtree: true })
    .filter((a) => a instanceof CSSAnimation && a.animationName.startsWith("ic-"));
  // allSettled: an animation cancelled mid-run (its host unmounted, reduced
  // motion switched on) rejects `finished`, and that still means "done".
  void Promise.allSettled(gestures.map((a) => a.finished)).then(() => {
    if (!leaving.has(host)) return; // came back while it played
    leaving.delete(host);
    host.classList.remove(LIVE);
  });
}

function hostOf(node: EventTarget | null): Element | null {
  const host = node instanceof Element ? node.closest(HOST) : null;
  // PARKED: each kind of host animates only while its flag is on —
  // `data-icon-motion="section"` (sidebar rows) and `="control"` (menu
  // button, hidden vibe note, dev-tools pen).
  const kind = host?.getAttribute("data-icon-motion");
  if (kind === "section" && !sectionIconMotion) return null;
  if (kind === "control" && !controlIconMotion) return null;
  return host;
}

/**
 * Pointer hover or keyboard focus starts a host's gesture; losing both lets
 * it finish and then releases it. Touch never starts one — a tap would leave
 * it running on a control nobody is pointing at.
 */
export function useIconMotion() {
  useEffect(() => {
    const over = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const host = hostOf(e.target);
      if (host && !host.contains(e.relatedTarget as Node | null)) iconEnter(host);
    };
    const out = (e: PointerEvent) => {
      const host = hostOf(e.target);
      if (!host || host.contains(e.relatedTarget as Node | null)) return;
      if (!host.matches(":focus-visible")) iconLeave(host);
    };
    const focusIn = (e: FocusEvent) => {
      const host = hostOf(e.target);
      if (host && host.matches(":focus-visible")) iconEnter(host);
    };
    const focusOut = (e: FocusEvent) => {
      const host = hostOf(e.target);
      if (host && !host.matches(":hover")) iconLeave(host);
    };
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    document.addEventListener("focusin", focusIn);
    document.addEventListener("focusout", focusOut);
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("focusin", focusIn);
      document.removeEventListener("focusout", focusOut);
    };
  }, []);
}
