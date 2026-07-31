"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ui } from "@/lib/ui-strings";
import { nameFor, withViewTransition } from "@/lib/view-transition";
import T from "./T";

/**
 * Global content lightbox: click any content image (`.prose img`, avatars
 * excluded) OR any inlined self-theming diagram (`.prose svg.diagram`) to view
 * it full size on a dimmed backdrop. Click the backdrop or press Escape to
 * close. Uses event delegation — no per-image wiring.
 *
 * Two kinds of content end up here:
 *
 * - **Images** — shown as an `<img>` pointing at the same source.
 * - **Inlined SVG diagrams** — re-rendered as markup rather than as an `<img>`,
 *   so their internal `prefers-color-scheme` styles stay live (the whole reason
 *   they are inlined in the first place; see lib/markdown.ts →
 *   `inlineSelfThemingSvg` and DECISIONS.md #10). Their CSS is namespaced to
 *   `#d-<filename>` by `scopeSvgCss`, so the copy gets a `-lightbox` suffix on
 *   both the id and every selector referencing it — otherwise the page would
 *   hold two elements with the same id.
 *
 * **The whole page is the gallery.** Opening one figure collects every other
 * visible one in document order, so ← / → (and the on-screen arrows) step
 * through a note's images without closing and reopening. The gallery is
 * rebuilt on each open rather than cached: the language toggle hides half the
 * document with `display: none`, and a note's Ukrainian copy of a figure must
 * not turn up in the middle of an English reader's gallery.
 *
 * The caption comes from the figure's `<figcaption>` when there is one, so the
 * language toggle's `.lang-en` / `.lang-uk` spans keep working inside the
 * overlay; it falls back to the image's alt text.
 *
 * **It opens as a zoom, not a fade.** The figure you clicked and the figure in
 * the overlay are the same picture, so they share a `view-transition-name` and
 * the browser tweens one into the other — the image grows out of the page
 * instead of a second copy appearing over it. Two details make that work:
 *
 * - The update runs inside `flushSync`, so the DOM has really changed before
 *   the API takes its "after" snapshot. Without it React would still be
 *   scheduling the render and the transition would capture nothing.
 * - The name is moved rather than copied. The thumbnail is still on the page
 *   underneath the overlay, and two elements sharing one transition name is an
 *   error — so the thumbnail's is released as the overlay's is applied, and
 *   handed back on the way out.
 *
 * Where the API is missing, or under `prefers-reduced-motion`, the same code
 * just sets state and the overlay appears — see lib/view-transition.ts.
 */

/** The shared name carried by the clicked figure and the overlay's copy. */
const ZOOM = "lightbox-figure";

type Shown =
  | { kind: "img"; src: string; alt: string; caption: string | null }
  | { kind: "svg"; markup: string; label: string; caption: string | null };

/** innerHTML of the clicked element's `<figcaption>`, if it sits in a figure. */
function captionOf(el: Element): string | null {
  const cap = el.closest("figure")?.querySelector("figcaption");
  return cap ? cap.innerHTML : null;
}

/** Re-namespace an inlined diagram so the copy doesn't collide with the original. */
function isolate(svg: SVGElement): string {
  const id = svg.id;
  const markup = svg.outerHTML;
  if (!id) return markup;
  return markup
    .split(`#${id}`)
    .join(`#${id}-lightbox`)
    .replace(`id="${id}"`, `id="${id}-lightbox"`);
}

/** Describe an element the lightbox can show, or null if it can't show it. */
function describe(el: Element): Shown | null {
  if (el instanceof HTMLImageElement) {
    return {
      kind: "img",
      src: el.currentSrc || el.src,
      alt: el.alt,
      caption: captionOf(el),
    };
  }
  if (el instanceof SVGElement) {
    return {
      kind: "svg",
      markup: isolate(el),
      label: el.getAttribute("aria-label") ?? "Diagram",
      caption: captionOf(el),
    };
  }
  return null;
}

/**
 * Every openable figure on the page, in document order, skipping anything the
 * language toggle has hidden (`offsetParent` is null for a `display: none`
 * subtree; SVG elements don't have it, so those are measured instead).
 */
function gallery(): Element[] {
  const all = Array.from(
    document.querySelectorAll(".prose img:not(.avatar), .prose svg.diagram")
  );
  return all.filter((el) =>
    el instanceof HTMLElement
      ? el.offsetParent !== null || el.getClientRects().length > 0
      : el.getClientRects().length > 0
  );
}

export default function Lightbox() {
  const [shown, setShown] = useState<Shown | null>(null);
  /** Index into the gallery captured when the lightbox opened. */
  const [items, setItems] = useState<Element[]>([]);
  const [index, setIndex] = useState(0);
  /** The page element the overlay grew out of — where it shrinks back to. */
  const origin = useRef<Element | null>(null);

  const close = useCallback(() => {
    const from = origin.current;
    let release = () => {};
    void withViewTransition(() => {
      flushSync(() => {
        setShown(null);
        setItems([]);
      });
      // Named only now: while the overlay existed it held the name, and the
      // two may never both have it. This is where the zoom lands.
      release = nameFor(from, ZOOM);
    }).then(() => {
      release();
      origin.current = null;
    });
  }, []);

  /** Move `delta` places through the gallery, wrapping around both ends. */
  const step = useCallback(
    (delta: number) => {
      if (items.length < 2) return;
      const next = (index + delta + items.length) % items.length;
      const described = describe(items[next]);
      if (!described) return;
      setIndex(next);
      setShown(described);
    },
    [items, index]
  );

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Element) || !t.closest(".prose")) return;

      // Diagrams are inlined SVG, so the click lands on a child <rect>/<text>.
      const el =
        t instanceof HTMLImageElement && !t.classList.contains("avatar")
          ? t
          : t.closest("svg.diagram");
      if (!el) return;

      const described = describe(el);
      if (!described) return;

      e.preventDefault();
      const list = gallery();
      origin.current = el;
      const release = nameFor(el, ZOOM);

      void withViewTransition(() => {
        flushSync(() => {
          setItems(list);
          setIndex(Math.max(list.indexOf(el), 0));
          setShown(described);
        });
        // The overlay now carries the name; the thumbnail must give it up
        // before the "after" snapshot is taken.
        release();
      });
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Keys are only bound while the overlay is open, so ← / → keep their normal
  // meaning (caret movement, browser history) on the page itself.
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close();
      if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, close, step]);

  if (!shown) return null;

  const label = shown.kind === "img" ? shown.alt : shown.label;
  const many = items.length > 1;

  /** Arrows are buttons on the backdrop — stop the click from closing it. */
  const arrow = (delta: number, str: { en: string; uk: string }) => (
    <button
      type="button"
      className={`lightbox-arrow ${delta < 0 ? "is-prev" : "is-next"}`}
      onClick={(e) => {
        e.stopPropagation();
        step(delta);
      }}
    >
      <span className="sr-only">
        <T {...str} />
      </span>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d={delta < 0 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label || "Preview"}
      onClick={close}
      className="fixed inset-0 z-[70] flex cursor-zoom-out flex-col items-center justify-center gap-3 bg-black/65 p-6 backdrop-blur-sm"
    >
      {many && arrow(-1, ui.previousImage)}
      {shown.kind === "img" ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={shown.src}
          alt={shown.alt}
          style={{ viewTransitionName: ZOOM }}
          className="max-h-[85vh] max-w-full rounded-lg object-contain"
        />
      ) : (
        <div
          style={{ viewTransitionName: ZOOM }}
          className="lightbox-diagram flex max-h-[85vh] w-full max-w-5xl items-center justify-center"
          dangerouslySetInnerHTML={{ __html: shown.markup }}
        />
      )}
      {shown.caption ? (
        <p
          className="text-sm text-white/70"
          dangerouslySetInnerHTML={{ __html: shown.caption }}
        />
      ) : (
        label && <p className="text-sm text-white/70">{label}</p>
      )}
      {many && (
        <p className="lightbox-count">
          {index + 1} / {items.length}
        </p>
      )}
      {many && arrow(1, ui.nextImage)}
    </div>
  );
}
