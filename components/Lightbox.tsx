"use client";

import { useEffect, useState } from "react";

/**
 * Global content lightbox: click any content image (`.prose img`, avatars
 * excluded) OR any inlined self-theming diagram (`.prose svg.diagram`) to view
 * it full size on a dimmed backdrop. Click anywhere or press Escape to close.
 * Uses event delegation — no per-image wiring.
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
 * The caption comes from the figure's `<figcaption>` when there is one, so the
 * language toggle's `.lang-en` / `.lang-uk` spans keep working inside the
 * overlay; it falls back to the image's alt text.
 */

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

export default function Lightbox() {
  const [shown, setShown] = useState<Shown | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Element) || !t.closest(".prose")) return;

      if (t instanceof HTMLImageElement && !t.classList.contains("avatar")) {
        e.preventDefault();
        setShown({
          kind: "img",
          src: t.currentSrc || t.src,
          alt: t.alt,
          caption: captionOf(t),
        });
        return;
      }

      // Diagrams are inlined SVG, so the click lands on a child <rect>/<text>.
      const svg = t.closest("svg.diagram");
      if (svg instanceof SVGElement) {
        e.preventDefault();
        setShown({
          kind: "svg",
          markup: isolate(svg),
          label: svg.getAttribute("aria-label") ?? "Diagram",
          caption: captionOf(svg),
        });
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShown(null);
    document.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!shown) return null;

  const label = shown.kind === "img" ? shown.alt : shown.label;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label || "Preview"}
      onClick={() => setShown(null)}
      className="fixed inset-0 z-[70] flex cursor-zoom-out flex-col items-center justify-center gap-3 bg-black/65 p-6 backdrop-blur-sm"
    >
      {shown.kind === "img" ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={shown.src}
          alt={shown.alt}
          className="max-h-[85vh] max-w-full rounded-lg object-contain"
        />
      ) : (
        <div
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
    </div>
  );
}
