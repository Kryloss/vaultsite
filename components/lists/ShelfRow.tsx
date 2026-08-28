"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";

/**
 * The horizontal scroller behind each shelf row: grab it and drag.
 *
 * It had a fade at whichever edge had more to come, and then a pair of hover
 * arrows; both are gone (see docs/DECISIONS.md #44, #45). What's left is the
 * thing people actually reached for — the row scrolls under the pointer, and
 * the grab cursor is the only affordance it needs.
 *
 * Drag is for mouse pointers, which is the whole point: a trackpad already
 * swipes a row sideways, a mouse can't. Touch is left to the browser, since
 * taking the pointer would trade momentum scrolling for something worse.
 *
 * It only becomes a drag once the pointer has really moved
 * (`DRAG_THRESHOLD`), so a click on a cover is still a click, and the click
 * that ends a drag is swallowed — the cover you happen to let go over is not
 * the one you meant to open.
 */

/** Ignore a pixel or two of sub-pixel rounding when asking if it scrolls. */
const EPSILON = 2;

/** Movement before a press becomes a drag rather than a click. */
const DRAG_THRESHOLD = 6;

export default function ShelfRow({
  className = "",
  style,
  children,
}: {
  className?: string;
  /** Custom properties the row is measured with — see BookSpines' lead gap. */
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLUListElement>(null);

  /* All of this changes on every pointer move and none of it belongs in a
     render — only the dragging class reaches the DOM. */
  const start = useRef({ x: 0, scroll: 0 });
  const moved = useRef(false);
  const active = useRef(false);

  const onPointerDown = (e: React.PointerEvent<HTMLUListElement>) => {
    if (e.pointerType === "touch" || e.button !== 0) return;
    const el = ref.current;
    // Nothing to drag in a row that already fits.
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
    // A drag ending outside a link produces no click, so nothing would clear
    // the flag; drop it once the click that might follow has passed.
    window.setTimeout(() => {
      moved.current = false;
    }, 0);
  };

  /** Swallow the click that ends a drag. */
  const onClickCapture = (e: React.MouseEvent) => {
    if (!moved.current) return;
    moved.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="shelf-row-wrap">
      <ul
        ref={ref}
        className={className}
        style={style}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
      >
        {children}
      </ul>
    </div>
  );
}
