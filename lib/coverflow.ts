/**
 * Which cover a press landed on, worked out from the cards' own boxes.
 *
 * The deck would rather ask the browser — `event.target.closest()` is exact
 * and free — but WEBKIT CANNOT HIT-TEST THE DECK. `.cf-stage` is
 * `transform-style: preserve-3d` and `paint()` pushes every card except the
 * centred one behind that plane with a negative `translateZ`; Safari, on the
 * phone and on the desktop alike, then refuses to hit-test them at all.
 * `document.elementFromPoint()` over the middle of any receded cover returns
 * `.cf-frame` — straight past the card — so the press arrives at the frame
 * with no card in its path and there is nothing for click-to-centre to
 * travel to. The centred cover is coplanar with the stage and works, which is
 * why the deck looked like it was ignoring exactly the presses meant to move
 * it. `docs/DECISIONS.md` #123.
 *
 * `getBoundingClientRect()` is right in every engine, WebKit included — the
 * boxes it reports for the raked cards match Chromium's to the pixel. So the
 * geometry is the fallback: ask the boxes what the browser will not.
 *
 * Kept here, and pure, because the vault cannot exercise it — the deck only
 * misbehaves in an engine the build never runs.
 */
export interface CardBox {
  /** The card's own index in the deck. */
  index: number;
  /** Painted stacking order. Higher is nearer the front (`paint()` writes it). */
  z: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The FRONTMOST card whose box contains the point, or null for empty deck.
 *
 * Cards overlap — that is what a rake is — so containment alone is not an
 * answer and the stacking order decides, exactly as it decides what the eye
 * sees. `z` runs `100 - distance from the centre`, so the nearer of two
 * overlapping covers wins, which is the one on top.
 */
export function cardAtPoint(
  boxes: readonly CardBox[],
  x: number,
  y: number
): number | null {
  let found: number | null = null;
  let top = -Infinity;

  for (const box of boxes) {
    if (x < box.left || x > box.right || y < box.top || y > box.bottom) continue;
    if (box.z <= top) continue;
    top = box.z;
    found = box.index;
  }

  return found;
}
