"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { LinkPreview as Preview } from "@/lib/previews";
import T from "./T";

/**
 * Hover previews for internal links in prose — the Obsidian page-preview
 * behaviour, on the site.
 *
 * Event delegation over the whole document (like components/Lightbox.tsx), so
 * links inside markdown HTML need no wiring. The index is passed in as props
 * from the layout (built at build time — see lib/previews.ts).
 *
 * Deliberately pointer-only: touch devices get nothing, because a tap should
 * just follow the link. The card itself is pointer-events: none, so it can
 * never swallow a click or get stuck open.
 */
const OPEN_DELAY = 350;
const CLOSE_DELAY = 180;
const CARD_WIDTH = 320;
const MARGIN = 12;
/** Enough room to render the tallest card below the link, else flip above.
   Two lines of title over three of excerpt, plus padding — the cover no
   longer sets a floor, it floats inside the text (see globals.css). */
const ESTIMATED_HEIGHT = 155;

interface Position {
  left: number;
  top?: number;
  bottom?: number;
}

export default function LinkPreview({ previews }: { previews: Preview[] }) {
  const pathname = usePathname();
  const [shown, setShown] = useState<{ p: Preview; pos: Position } | null>(null);

  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);
  /** The link currently under the pointer — keeps hover state from thrashing. */
  const hovered = useRef<HTMLAnchorElement | null>(null);

  const clearTimers = useCallback(() => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  }, []);

  // Close whenever the page changes underneath us.
  useEffect(() => {
    clearTimers();
    setShown(null);
  }, [pathname, clearTimers]);

  useEffect(() => {
    // Pointer-only feature: no hover on touch, so don't even listen.
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const byHref = new Map(previews.map((p) => [p.href, p]));

    const lookup = (a: HTMLAnchorElement): Preview | undefined => {
      const raw = a.getAttribute("href");
      if (!raw || !raw.startsWith("/")) return undefined; // internal only
      const path = raw.split(/[?#]/)[0].replace(/\/$/, "") || "/";
      let key = path;
      try {
        key = decodeURI(path);
      } catch {
        /* malformed escape — fall back to the raw path */
      }
      const p = byHref.get(key) ?? byHref.get(path);
      // Don't preview the page you're already on.
      if (!p || p.href === (pathname.replace(/\/$/, "") || "/")) return undefined;
      return p;
    };

    const position = (a: HTMLAnchorElement): Position => {
      const r = a.getBoundingClientRect();
      const width = Math.min(CARD_WIDTH, window.innerWidth - MARGIN * 2);
      const left = Math.min(
        Math.max(r.left, MARGIN),
        window.innerWidth - width - MARGIN
      );
      const spaceBelow = window.innerHeight - r.bottom;
      // Anchoring by `bottom` when flipping up means we never have to measure
      // the card's real height.
      return spaceBelow < ESTIMATED_HEIGHT && r.top > ESTIMATED_HEIGHT
        ? { left, bottom: window.innerHeight - r.top + 8 }
        : { left, top: r.bottom + 8 };
    };

    const onOver = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const a = t.closest("a");
      if (!(a instanceof HTMLAnchorElement) || !a.closest(".prose")) return;

      // Moving around inside the same link shouldn't restart the open delay.
      if (a === hovered.current) {
        window.clearTimeout(closeTimer.current);
        return;
      }

      const p = lookup(a);
      if (!p) return;

      hovered.current = a;
      clearTimers();
      openTimer.current = window.setTimeout(
        () => setShown({ p, pos: position(a) }),
        OPEN_DELAY
      );
    };

    const onOut = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const a = t.closest("a");
      if (!a || a !== hovered.current) return;

      // mouseout also fires when crossing between children of the same link.
      const to = e.relatedTarget;
      if (to instanceof Node && a.contains(to)) return;

      hovered.current = null;
      clearTimers();
      closeTimer.current = window.setTimeout(() => setShown(null), CLOSE_DELAY);
    };

    const close = () => {
      clearTimers();
      hovered.current = null;
      setShown(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();

    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimers();
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      window.removeEventListener("scroll", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [previews, pathname, clearTimers]);

  if (!shown) return null;
  const { p, pos } = shown;

  return (
    <div
      className="link-preview"
      // Tells the CSS to stop shrink-wrapping — see globals.css for why a
      // floated cover can't be measured by `fit-content`.
      data-cover={p.cover ? "" : undefined}
      role="tooltip"
      aria-hidden="true"
      style={{
        left: pos.left,
        ...(pos.top !== undefined ? { top: pos.top } : {}),
        ...(pos.bottom !== undefined ? { bottom: pos.bottom } : {}),
      }}
    >
      {p.cover && (
        // The cover floats and the excerpt wraps beneath it, so its height is
        // free: --cover-ar lets CSS give every image its own proportions
        // inside one box instead of cropping them all to 2:3.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="link-preview-cover"
          src={p.cover}
          srcSet={p.coverSrcSet}
          sizes="80px"
          alt=""
          style={{ "--cover-ar": p.coverAr } as CSSProperties}
        />
      )}
      <p className="link-preview-meta">
        <T en={p.section} uk={p.sectionUk} />
        {p.dateLabel && (
          <>
            <span aria-hidden> · </span>
            <T en={p.dateLabel} uk={p.dateLabelUk} />
          </>
        )}
      </p>
      <p className="link-preview-title">
        <T en={p.title} uk={p.titleUk} />
      </p>
      {p.excerpt && (
        <p className="link-preview-excerpt">
          <T en={p.excerpt} uk={p.excerptUk} />
        </p>
      )}
    </div>
  );
}
