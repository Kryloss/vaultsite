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
 * instead of a second copy appearing over it. Three details make that work:
 *
 * - The update runs inside `flushSync`, so the DOM has really changed before
 *   the API takes its "after" snapshot. Without it React would still be
 *   scheduling the render and the transition would capture nothing.
 * - The name is moved rather than copied: two elements sharing one transition
 *   name is an error. Whatever holds it on one side of a transition gives it
 *   up before the other side's snapshot is taken.
 * - On the way in, the thumbnail never carries the name. A named element is
 *   cut out of the page snapshot, so the small version would vanish for the
 *   length of the zoom and pop back after it. An empty placeholder laid over
 *   the thumbnail (`stand-in`) carries it instead: the zoom only needs its
 *   box, because the "before" picture is hidden anyway (globals.css), and
 *   the thumbnail stays in the page snapshot, blurring and dimming with the
 *   rest of the page. A second named copy of the thumbnail was tried first
 *   and slid about under the blur in Safari (DECISIONS.md #177). Closing
 *   lands on a stand-in too, showing the shrinking overlay picture instead
 *   of the thumbnail, so the thumbnail brightens with the page underneath.
 *   The caption gets the same treatment under its own name (`CAPTION`), so
 *   it travels with the picture instead of popping in after it, in
 *   `--text-caption` at both ends so it never changes colour on the way.
 *
 * Where the API is missing, or under `prefers-reduced-motion`, the same code
 * just sets state and the overlay appears — see lib/view-transition.ts.
 */

/** The shared name carried by the clicked figure and the overlay's copy. */
const ZOOM = "lightbox-figure";
/** The same for the figure's caption, which travels with it. */
const CAPTION = "lightbox-caption";
/**
 * The overlay's own controls. They have no page counterpart to grow out of,
 * so each fades in (the engine's default for a name with no "before") while
 * `travel()` moves it the way the picture moves.
 */
const CONTROLS = {
  prev: "lightbox-prev",
  next: "lightbox-next",
  count: "lightbox-count",
} as const;
/** The zoom's timing, for `travel()`: 320ms and the curve are `--dur-slow`
 *  and `--ease`, written out like the `lightbox-figure` group's in globals.css. */
const ZOOM_TIMING = { duration: 320, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" };

type Shown =
  | { kind: "img"; src: string; alt: string; caption: string | null }
  | { kind: "svg"; markup: string; label: string; caption: string | null };

/** The `<figcaption>` of the figure the element sits in, if any. */
function figcaptionOf(el: Element): Element | null {
  return el.closest("figure")?.querySelector("figcaption") ?? null;
}

/** innerHTML of the clicked element's `<figcaption>`, if it sits in a figure. */
function captionOf(el: Element): string | null {
  return figcaptionOf(el)?.innerHTML ?? null;
}

/** An empty named box over `r`, fixed to the viewport so scroll can't shift it. */
function box(r: DOMRect, name: string): HTMLElement {
  const b = document.createElement("div");
  b.setAttribute("aria-hidden", "true");
  Object.assign(b.style, {
    position: "fixed",
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    pointerEvents: "none",
  });
  nameFor(b, name);
  document.body.append(b);
  return b;
}

/**
 * Stand-ins for a page figure — see "never carries the name" above: one over
 * `el` exactly as drawn (hover scale included), and one over its caption's
 * text, so the overlay's caption travels with the picture. The caption's is
 * the text's own extent, not the full-width `<figcaption>` block: the overlay
 * caption is shrink-wrapped, and the two boxes must share a shape or the text
 * would stretch on the way. Both captions are `--text-caption`, so the text
 * is one colour from start to finish.
 */
function standIns(el: Element): HTMLElement[] {
  const boxes = [box(el.getBoundingClientRect(), ZOOM)];
  const cap = figcaptionOf(el);
  if (cap) {
    const text = document.createRange();
    text.selectNodeContents(cap);
    const r = text.getBoundingClientRect();
    if (r.width > 0) boxes.push(box(r, CAPTION));
  }
  return boxes;
}

/** Where each overlay control is drawn, by transition name. */
function controlRects(dialog: HTMLElement | null): [string, DOMRect][] {
  if (!dialog) return [];
  return Array.from(dialog.querySelectorAll<HTMLElement>("[data-travel]"), (el) => [
    el.dataset.travel ?? "",
    el.getBoundingClientRect(),
  ]);
}

/**
 * Carry the controls along with the zoom. Each control's spot relative to the
 * overlay picture is mapped onto the thumbnail at the thumbnail's scale, and
 * its transition group is animated between that and where it really is:
 * inward on the way in, outward on the way out. Width and height scale the
 * snapshot, exactly as the engine does for a pair.
 */
function travel(
  picture: DOMRect,
  thumb: DOMRect,
  controls: [string, DOMRect][],
  opening: boolean
) {
  if (!picture.width) return;
  const s = thumb.width / picture.width;
  for (const [name, r] of controls) {
    const at = {
      transform: `matrix(1, 0, 0, 1, ${r.left}, ${r.top})`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    };
    const near = {
      transform: `matrix(1, 0, 0, 1, ${thumb.left + (r.left - picture.left) * s}, ${
        thumb.top + (r.top - picture.top) * s
      })`,
      width: `${r.width * s}px`,
      height: `${r.height * s}px`,
    };
    try {
      document.documentElement.animate(opening ? [near, at] : [at, near], {
        ...ZOOM_TIMING,
        fill: "both",
        pseudoElement: `::view-transition-group(${name})`,
      });
    } catch {
      // An engine without pseudo-element animation still fades them.
    }
  }
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
  const dialog = useRef<HTMLDivElement>(null);
  /** The overlay's copy of the figure, for measuring the zoom's far end. */
  const picture = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    const from = origin.current;
    let boxes: HTMLElement[] = [];
    // Measured while the overlay is still up: the controls leave with it.
    const pictureAt = picture.current?.getBoundingClientRect();
    const controls = controlRects(dialog.current);
    // Shows the shrinking picture itself on the way out (globals.css).
    const root = document.documentElement;
    root.classList.add("lightbox-closing");
    void withViewTransition(
      () => {
        flushSync(() => {
          setShown(null);
          setItems([]);
        });
        // Named only now: while the overlay existed it held the name, and the
        // two may never both have it. This is where the zoom lands — a
        // stand-in again, so the thumbnail stays in the page snapshot instead
        // of fading out of it before the picture arrives.
        if (from) boxes = standIns(from);
      },
      () => {
        if (from && pictureAt) {
          travel(pictureAt, from.getBoundingClientRect(), controls, false);
        }
      }
    ).then(() => {
      boxes.forEach((b) => b.remove());
      root.classList.remove("lightbox-closing");
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
      // Close back into the figure on show, not the one first clicked, so
      // the picture and its caption shrink onto their own thumbnail.
      origin.current = items[next];
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
      // The zoom starts from a stand-in, so the thumbnail itself stays in the
      // page snapshot rather than leaving a hole there while it plays.
      const boxes = standIns(el);
      // Marks this transition as an opening, so globals.css can blur and dim
      // the page behind the picture while it zooms (see `.lightbox-opening`).
      const root = document.documentElement;
      root.classList.add("lightbox-opening");
      const thumb = el.getBoundingClientRect();
      let pictureAt: DOMRect | undefined;
      let controls: [string, DOMRect][] = [];

      void withViewTransition(
        () => {
          flushSync(() => {
            setItems(list);
            setIndex(Math.max(list.indexOf(el), 0));
            setShown(described);
          });
          // The overlay now carries the name; the stand-in must be gone
          // before the "after" snapshot is taken.
          boxes.forEach((b) => b.remove());
          pictureAt = picture.current?.getBoundingClientRect();
          controls = controlRects(dialog.current);
        },
        () => {
          if (pictureAt) travel(pictureAt, thumb, controls, true);
        }
      ).then(() => root.classList.remove("lightbox-opening"));
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
      data-travel={delta < 0 ? CONTROLS.prev : CONTROLS.next}
      style={{ viewTransitionName: delta < 0 ? CONTROLS.prev : CONTROLS.next }}
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
      ref={dialog}
      onClick={close}
      className="fixed inset-0 z-[70] flex cursor-zoom-out flex-col items-center justify-center gap-3 bg-black/65 p-6 backdrop-blur-sm"
    >
      {shown.kind === "img" ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          ref={(n) => {
            picture.current = n;
          }}
          src={shown.src}
          alt={shown.alt}
          style={{ viewTransitionName: ZOOM }}
          className="max-h-[85vh] max-w-full rounded-lg object-contain"
        />
      ) : (
        <div
          ref={(n) => {
            picture.current = n;
          }}
          style={{ viewTransitionName: ZOOM }}
          className="lightbox-diagram flex max-h-[85vh] w-full max-w-5xl items-center justify-center"
          dangerouslySetInnerHTML={{ __html: shown.markup }}
        />
      )}
      {shown.caption ? (
        <p
          style={{ viewTransitionName: CAPTION }}
          className="text-sm text-[var(--text-caption)]"
          dangerouslySetInnerHTML={{ __html: shown.caption }}
        />
      ) : (
        label && <p className="text-sm text-[var(--text-caption)]">{label}</p>
      )}
      {/* One row holding both arrows and the counter: "‹ 1 / 2 ›".
          On a phone the arrows sit inside it, beside the number, where a
          thumb already is and where they can't cover the picture. From 640px
          they go back to floating at the left and right edges of the
          backdrop — see globals.css; the markup is the same either way. */}
      {many && (
        <div className="lightbox-nav">
          {arrow(-1, ui.previousImage)}
          <p
            data-travel={CONTROLS.count}
            style={{ viewTransitionName: CONTROLS.count }}
            className="lightbox-count"
          >
            {index + 1} / {items.length}
          </p>
          {arrow(1, ui.nextImage)}
        </div>
      )}
    </div>
  );
}
