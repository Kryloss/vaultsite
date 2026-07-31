"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The horizontal scroller behind each shelf row: grab it and drag, or use the
 * arrows that appear at either end.
 *
 * The row hides its scrollbar, which looks clean and takes away the only
 * signal that it continues off-screen. This used to put that signal back with
 * a fade at the edge — pretty, but passive: it said "there is more" and gave
 * you nothing to do about it, while dimming the covers it was drawing
 * attention to. Two controls replace it, and both are things you can act on.
 *
 * **Drag** works on any pointer, which on a desktop is the whole point — a
 * trackpad can already swipe a row sideways, a mouse can't. It only starts
 * once the pointer has really moved (`DRAG_THRESHOLD`), so a click on a cover
 * is still a click, and the click that ends a drag is swallowed so you don't
 * open whatever you happened to let go over.
 *
 * **Arrows** page the row by most of its width and each hides itself at its
 * own end. They're real buttons, so the row is reachable without a pointer at
 * all — which the fade never was.
 */

/** Ignore a pixel or two of sub-pixel rounding at either end. */
const EPSILON = 2;

/** Movement before a press becomes a drag rather than a click. */
const DRAG_THRESHOLD = 6;

/** How much of the visible width one arrow press travels. */
const PAGE_FRACTION = 0.8;

export default function ShelfRow({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= EPSILON) {
      // Everything fits: no arrows, nothing to drag.
      setAtStart(true);
      setAtEnd(true);
      return;
    }
    setAtStart(el.scrollLeft <= EPSILON);
    setAtEnd(el.scrollLeft >= max - EPSILON);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const onScroll = () => {
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          measure();
        });
      }
    };

    measure();
    el.addEventListener("scroll", onScroll, { passive: true });
    // Covers arriving, the window resizing, or the language toggle changing a
    // caption's width all change whether there's anything left to scroll to.
    const ro = new ResizeObserver(onScroll);
    ro.observe(el);
    window.addEventListener("langchange", measure);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      window.removeEventListener("langchange", measure);
    };
  }, [measure]);

  /* Drag state lives in refs: it changes on every pointer move, and none of it
     belongs in a render. Only the dragging class reaches the DOM. */
  const start = useRef({ x: 0, scroll: 0 });
  const moved = useRef(false);
  const active = useRef(false);

  const onPointerDown = (e: React.PointerEvent<HTMLUListElement>) => {
    // Touch already scrolls the row natively, and taking the pointer from it
    // would trade momentum scrolling for something worse.
    if (e.pointerType === "touch" || e.button !== 0) return;
    const el = ref.current;
    if (!el || el.scrollWidth - el.clientWidth <= EPSILON) return;
    active.current = true;
    moved.current = false;
    start.current = { x: e.clientX, scroll: el.scrollLeft };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLUListElement>) => {
    if (!active.current) return;
    const el = ref.current;
    if (!el) return;
    const dx = e.clientX - start.current.x;
    if (!moved.current) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      moved.current = true;
      // Captured only once it's really a drag, so a plain click is untouched.
      el.setPointerCapture(e.pointerId);
      el.classList.add("is-dragging");
    }
    el.scrollLeft = start.current.scroll - dx;
  };

  const endDrag = (e: React.PointerEvent<HTMLUListElement>) => {
    const el = ref.current;
    active.current = false;
    if (!el) return;
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    el.classList.remove("is-dragging");
  };

  /**
   * Swallow the click that ends a drag — the cover under the pointer at the
   * end of a swipe is not the cover you meant to open.
   */
  const onClickCapture = (e: React.MouseEvent) => {
    if (!moved.current) return;
    moved.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const page = (direction: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({
      left: direction * el.clientWidth * PAGE_FRACTION,
      behavior: "smooth",
    });
  };

  const arrow = (direction: 1 | -1, hidden: boolean) => (
    <button
      type="button"
      className={`shelf-arrow ${direction < 0 ? "is-prev" : "is-next"}`}
      hidden={hidden}
      aria-label={direction < 0 ? "Scroll left" : "Scroll right"}
      onClick={() => page(direction)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d={direction < 0 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
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
    <div className="shelf-row-wrap">
      <ul
        ref={ref}
        className={className}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
      >
        {children}
      </ul>
      {arrow(-1, atStart)}
      {arrow(1, atEnd)}
    </div>
  );
}
