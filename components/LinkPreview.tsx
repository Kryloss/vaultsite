"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { LinkPreview as Preview } from "@/lib/previews";
import T from "./T";
import { ui } from "@/lib/ui-strings";

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
const OPEN_DELAY = 120;
const CLOSE_DELAY = 100;
/** With a card already up, the next link's card follows almost at once. */
const WARM_DELAY = 40;
/** How long a leaving card stays mounted: `--dur-fast`, its exit animation. */
const EXIT_MS = 120;
const MARGIN = 12;
/** The card sits a little right of dead centre under its link. */
const SHIFT = 36;
/** Between the link and the card. */
const GAP = 8;
interface Shown {
  p: Preview;
  /** The link it belongs to; the card is placed from it once it has a size. */
  link: HTMLAnchorElement;
  /** Still mounted, playing its exit animation. */
  closing?: boolean;
}

export default function LinkPreview({ previews }: { previews: Preview[] }) {
  const pathname = usePathname();
  const [shown, setShown] = useState<Shown | null>(null);

  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);
  const exitTimer = useRef<number | undefined>(undefined);
  /** A card is up and not leaving — the next one may skip the open delay. */
  const warm = useRef(false);
  /** The link currently under the pointer — keeps hover state from thrashing. */
  const hovered = useRef<HTMLAnchorElement | null>(null);

  const clearTimers = useCallback(() => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => {
    warm.current = !!shown && !shown.closing;
  }, [shown]);

  /** Let the card play its exit, then unmount it — unless a new card has
     taken its place in the meantime. */
  const dismiss = useCallback(() => {
    setShown((s) => (s && !s.closing ? { ...s, closing: true } : s));
    // `scroll` calls this on every event; the first one starts the clock.
    if (exitTimer.current !== undefined) return;
    exitTimer.current = window.setTimeout(() => {
      exitTimer.current = undefined;
      setShown((s) => (s?.closing ? null : s));
    }, EXIT_MS);
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
        () => setShown({ p, link: a }),
        warm.current ? WARM_DELAY : OPEN_DELAY
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
      closeTimer.current = window.setTimeout(dismiss, CLOSE_DELAY);
    };

    const close = () => {
      clearTimers();
      hovered.current = null;
      dismiss();
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
  }, [previews, pathname, clearTimers, dismiss]);

  useEffect(() => () => window.clearTimeout(exitTimer.current), []);

  // Place the card before paint, by MEASURING rather than by arithmetic on
  // viewport numbers.
  //
  // Under a pinch zoom there are two viewports — the full layout one that
  // `position: fixed` is laid out against, and the zoomed-in visual one — and
  // browsers disagree about which of them `getBoundingClientRect()` and
  // `innerWidth/innerHeight` describe. Trusting any of them put the card up
  // and to the left of its link. So: park the card at 0,0, read where that
  // actually lands in the same coordinates the link's rectangle is in, and
  // place it by the difference. Whatever the browser means by those
  // coordinates, the link and the card now agree.
  //
  // The size is measured too: guessing (20rem wide, 155px tall) put a small
  // card far from its link whenever the window was small in CSS pixels.
  const card = useRef<HTMLDivElement>(null);
  const link = shown?.link;
  const href = shown?.p.href;
  useLayoutEffect(() => {
    const el = card.current;
    if (!el || !link) return;

    // Measured at rest: the entrance animation starts scaled and offset.
    el.style.animation = "none";
    el.style.left = "0px";
    el.style.top = "0px";
    const at0 = el.getBoundingClientRect();
    const w = at0.width;
    const h = at0.height;
    // Where `left: 0; top: 0` lands. `left` is the card's CENTRE: the CSS
    // shifts it back by half its width.
    const dx = at0.left + w / 2;
    const dy = at0.top;

    // The part of the page actually on screen, in those same coordinates.
    const vv = window.visualViewport;
    const root = document.documentElement;
    const x0 = (vv?.offsetLeft ?? 0) + dx;
    const y0 = (vv?.offsetTop ?? 0) + dy;
    const x1 = x0 + (vv?.width ?? root.clientWidth);
    const y1 = y0 + (vv?.height ?? root.clientHeight);

    const r = link.getBoundingClientRect();
    const half = w / 2 + MARGIN;
    const centre =
      x1 - x0 < half * 2
        ? (x0 + x1) / 2
        : Math.min(Math.max(r.left + r.width / 2 + SHIFT, x0 + half), x1 - half);

    // Below the link unless it only fits above.
    const need = h + GAP + MARGIN;
    const above = y1 - r.bottom < need && r.top - y0 >= need;
    el.dataset.side = above ? "above" : "below";
    el.style.left = `${centre - dx}px`;
    el.style.top = `${(above ? r.top - GAP - h : r.bottom + GAP) - dy}px`;
    el.style.animation = "";
  }, [link, href]);

  if (!shown) return null;
  const { p, closing } = shown;
  const isPost = !!(p.minutes && p.dateLabel);

  return (
    <div
      // A different note's card is a new card: it arrives again.
      key={p.href}
      ref={card}
      className="link-preview"
      data-state={closing ? "closing" : "open"}
      // Tells the CSS to stop shrink-wrapping — see globals.css for why a
      // floated cover can't be measured by `fit-content`.
      data-cover={p.cover ? "" : undefined}
      role="tooltip"
      aria-hidden="true"
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
      {/* Title first, then one grey line, then the excerpt (#219). A post's
          line is the one under its own title — "date · 3 min read" (#196);
          any other note says where it lives. A section has no line. */}
      <p className="link-preview-title">
        <T en={p.title} uk={p.titleUk} />
      </p>
      {isPost ? (
        <p className="link-preview-meta">
          <T en={p.dateLabel!} uk={p.dateLabelUk} />
          <span aria-hidden> · </span>
          {p.minutes} <T {...ui.minRead} />
        </p>
      ) : p.section ? (
        <p className="link-preview-meta">
          <T en={p.section} uk={p.sectionUk} />
          {p.dateLabel && (
            <>
              <span aria-hidden> · </span>
              <T en={p.dateLabel} uk={p.dateLabelUk} />
            </>
          )}
        </p>
      ) : null}
      {p.excerpt && (
        <p className="link-preview-excerpt">
          <T en={p.excerpt} uk={p.excerptUk} />
        </p>
      )}
    </div>
  );
}
