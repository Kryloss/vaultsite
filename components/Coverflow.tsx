"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * A Cover Flow deck: square artwork raked away from a centred card in 3D.
 *
 * Adapted from ruixen.ui's coverflow-carousel and re-cut for this site. What
 * changed, and why:
 *
 * - The cards are REAL LINKS, not divs. Every cover is an `<a href>` to its
 *   note, so all of them are in the static HTML with their titles — this site
 *   has no backend and every list it draws has to survive with no JS.
 * - There is a NO-JS / PRE-HYDRATION layout. Until `ready` flips in a layout
 *   effect the cards are a plain wrapped row, because the 3D arrangement is
 *   written straight to `style.transform` by `paint()` and without it all
 *   twenty-nine would stack on one spot. `ready` is set before the browser
 *   paints, so nobody with JS sees the fallback.
 * - Clicking an OFF-CENTRE card centres it instead of navigating. That is the
 *   original Cover Flow behaviour, and it is also the honest one: a card
 *   turned 60° away is not something you can read well enough to choose.
 * - `prefers-reduced-motion` skips the settle and jumps.
 * - Tailwind utility classes and `lucide-react` are gone; everything is
 *   `.cf-*` in globals.css, against this site's own tokens.
 *
 * The mechanism is unchanged and worth keeping in mind: `posRef` is a
 * FRACTIONAL card index, painted imperatively to the DOM. Sixty state updates
 * a second would re-render every card for numbers React never needs to see.
 */

export interface CoverflowItem {
  /** Unique and stable — the note's slug. */
  key: string;
  href: string;
  src?: string;
  srcSet?: string;
  /** Data-URL placeholder painted as the image's own background (lib/blur.ts). */
  blur?: string;
  /** What the card is, for the link's accessible name and the dot's label. */
  label: string;
}

export interface CoverflowProps {
  items: CoverflowItem[];
  /**
   * Drawn ABOVE the deck for whichever card is centred — whose record this is,
   * rather than what the record is. Its slot is always rendered and always the
   * same height, even when a card has no header to show: anything above the
   * deck that changes size moves the deck itself.
   */
  header?: (index: number) => ReactNode;
  /** Drawn under the deck for whichever card is centred. */
  caption?: (index: number) => ReactNode;
  /**
   * Told which card is centred, whenever that changes.
   *
   * For chrome that lives OUTSIDE the deck and still has to follow it — the
   * /music toolbar shows the centred record's artist beside its heading. Held
   * in a ref and called imperatively, so passing a fresh closure every render
   * costs nothing and cannot loop an effect.
   */
  onSelect?: (index: number) => void;
  /** Names the deck for assistive tech. */
  label: string;
  /** Degrees the first neighbour tilts. */
  rotate?: number;
  /** How far the first neighbour recedes, as a fraction of card width. */
  depth?: number;
  /** Viewer distance as a multiple of card width — smaller is a wider lens. */
  perspective?: number;
  /** Exponent on distance. Below 1 the rake eases off as cards travel out. */
  falloff?: number;
  /** Opacity lost per step from the centre. */
  fade?: number;
  /** Space between cards, as a fraction of card width. */
  gap?: number;
}

/**
 * How far a pointer must travel before the deck starts following it.
 *
 * 10px, not the 6 it started at: a press off a trackpad routinely drifts a few
 * pixels, and at 6 that was enough to start dragging.
 */
const DRAG_SLOP = 10;

/**
 * How far the deck must actually TRAVEL, in cards, for the gesture to count as
 * a drag rather than a press.
 *
 * This is the one that matters, and it is measured on the OUTCOME rather than
 * the intent. Thresholding the pointer's movement alone kept failing the same
 * way — reported as "when I click it starts dragging instead of scrolling to
 * the cover" — because any hand is capable of moving further than a threshold
 * while plainly meaning to press something, and past it the deck would shuffle
 * a few pixels, snap back to the card it was already on, and swallow the click
 * that would have travelled.
 *
 * A fifth of a card is not a navigation. If the deck ends up within that of
 * where it started, the gesture is treated as a press on whichever cover it
 * began on, however far the hand wandered getting there — because a drag that
 * goes nowhere and a click are the same request.
 */
const TAP_TRAVEL = 0.2;

/**
 * Below this the ring is too short to hide the teleport: a card is moved
 * across at half a turn out, and at four cards that is the neighbour you can
 * still see. Short decks simply stop at their ends.
 */
const MIN_LOOP = 5;

const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function Coverflow({
  items,
  header,
  caption,
  onSelect,
  label,
  rotate = 44,
  depth = 0.6,
  perspective = 3,
  falloff = 0.56,
  fade = 0.11,
  gap = 0.05,
}: CoverflowProps) {
  const count = items.length;
  const loop = count >= MIN_LOOP;

  const frameRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  /** Fractional card index at the centre. The single source of truth. */
  const posRef = useRef(0);
  /** Where the current settle is headed. Stepping off `pos` instead would
      swallow a keypress that lands mid-flight, before the round-off moves. */
  const targetRef = useRef(0);
  const widthRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const dragRef = useRef<{
    id: number;
    x: number;
    pos: number;
    v: number;
    t: number;
    moved: number;
    captured: boolean;
    /** Which card the press landed on, if any. Read from the DOM, not React. */
    card: number | null;
  } | null>(null);

  /* Set when a pointer interaction actually moved, and read by the click that
     follows the release: a drag that ends on a card must not open it. Cleared
     on the next pointerdown rather than on a timer, because the order of a
     `setTimeout(0)` against the click event is not something to bet on. */
  const draggedRef = useRef(false);
  /**
   * Set on release when the click that follows must not open a note — because
   * the gesture was a drag, or because it was a press on an off-centre cover
   * that has just been sent to the middle instead.
   *
   * The DECISION IS MADE ON `pointerup`, not in the click handler, and that is
   * the whole point of this ref. Deciding it at click time meant depending on
   * three things lining up — that the browser had not focused the link first
   * and changed what "centred" meant, that React's state was not a render
   * behind, and that the click fired on the card rather than somewhere the
   * pointer had wandered. Each of those was a separate bug. By `pointerup`
   * the gesture is over and everything it needs is known.
   */
  const suppressClickRef = useRef(false);

  /**
   * The centred card, as a ref.
   *
   * The same value as `selected`, kept beside it because the click handler
   * cannot use the state: React's copy is a render behind, and `targetRef` is
   * no good either — `onPointerDown` overwrites that with the live position on
   * every press, so a card clicked while the previous settle was still flying
   * compared itself against wherever the deck happened to be mid-air and could
   * decide it was already centred. It then opened the note instead of
   * travelling to it. Only `settle` and the drag write this.
   */
  const centredRef = useRef(0);

  const [selected, setSelected] = useState(0);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  /** Every place the centre changes goes through here, so nothing is missed. */
  const setCentre = useCallback((index: number) => {
    centredRef.current = index;
    setSelected(index);
    onSelectRef.current?.(index);
  }, []);
  /* False through SSR and the first client render, so both agree; flipped in
     a layout effect, which runs before the browser paints. */
  const [ready, setReady] = useState(false);

  /** Nearest whole card, folded back into 0..count-1. */
  const indexAt = useCallback(
    (pos: number) => (count ? ((Math.round(pos) % count) + count) % count : 0),
    [count]
  );

  const paint = useCallback(() => {
    const width = widthRef.current;
    if (!width || !count) return;
    const pitch = width * (1 + gap);
    const pos = posRef.current;

    cardRefs.current.forEach((card, index) => {
      if (!card) return;

      /* Fold the distance into the shorter way round the ring. This is the
         whole looping mechanism — no cloned nodes, no shuffling the DOM. */
      let offset = index - pos;
      if (loop) {
        offset = ((offset % count) + count) % count;
        if (offset > count / 2) offset -= count;
      }

      const distance = Math.abs(offset);
      /* Both the tilt and the recession ease off as cards travel out —
         doubling the distance adds only about half again as much of each. A
         linear ramp folds the second card shut; this keeps it readable. */
      const ramp = Math.pow(distance, falloff);
      /* Capped short of edge-on so a far card never turns its back. */
      const tilt = Math.min(rotate * ramp, 82) * Math.sign(offset);

      card.style.transform =
        `translateX(calc(-50% + ${offset * pitch}px)) ` +
        `translateZ(${-depth * width * ramp}px) rotateY(${-tilt}deg)`;

      /* A card is teleported across the ring at exactly half a turn out, so it
         has to be gone by then or the jump is visible. */
      const edge = loop ? Math.min(1, Math.max(0, count / 2 - distance)) : 1;
      /* How much of this cover is left, as it recedes. NOT written to the
         element's `opacity` — see below. */
      const dim = Math.max(0, 1 - fade * distance);
      const opacity = dim * edge;

      /* THE CARD ITSELF STAYS OPAQUE. `opacity` on the element made the whole
         card translucent, and a stack of translucent cards is a stack you can
         see through: wherever two covers met, the darker one behind showed
         through the artwork of the one in front, and the neighbour's shadow
         came through with it. Records are physical objects in this layout and
         objects do not do that.

         So the recession is painted on the ARTWORK instead (`--cf-fade`, read
         by `.cf-card img` in globals.css) and the card keeps an opaque `--bg`
         ground underneath it. Against the page the result is what it always
         was — a cover blended into the background by exactly `dim` — but the
         card now occludes whatever is behind it, because it is a solid thing
         the colour of the page rather than a hole in one.

         `opacity` is left to `edge` alone, which is the teleport fade: there
         the card genuinely has to stop existing, ground and all. It is 1 for
         every card anyone can see. */
      card.style.opacity = String(edge);
      card.style.setProperty("--cf-fade", String(dim));
      card.style.zIndex = String(100 - Math.round(distance));
      /* A card faded to nothing is still a link on top of the page. Taking it
         out of the hit-testing is what stops an invisible cover swallowing a
         click meant for the one behind it, and out of the tab order is what
         stops Tab walking into cards nobody can see.

         Clearing the inline value rather than writing "auto" hands the card
         back to `.cf-card`'s own `pointer-events: auto` — which is NOT
         decoration. `.cf-stage` is `pointer-events: none` because under
         `preserve-3d` its box shares the cards' 3D space at z = 0, and every
         card below is pushed behind that plane by the `translateZ` written a
         few lines up: without the pair, the stage swallows every press aimed
         at an off-centre cover and `endDrag` never sees a card to travel to.
         See globals.css and DECISIONS #123. */
      const gone = opacity < 0.06;
      card.style.pointerEvents = gone ? "none" : "";
      card.tabIndex = gone ? -1 : 0;
      if (gone) card.setAttribute("aria-hidden", "true");
      else card.removeAttribute("aria-hidden");
    });
  }, [count, depth, fade, falloff, gap, loop, rotate]);

  const settle = useCallback(
    (target: number) => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      targetRef.current = target;
      setCentre(indexAt(target));

      /* Read live rather than held in state: the deck is imperative already,
         and a reader who turns the setting on mid-page gets it immediately. */
      const still =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (still) {
        posRef.current = target;
        paint();
        rafRef.current = null;
        return;
      }

      const step = () => {
        const remaining = target - posRef.current;
        if (Math.abs(remaining) < 0.0004) {
          posRef.current = target;
          paint();
          rafRef.current = null;
          return;
        }
        /* Exponential ease-out, not a spring. Swap in a spring only if the
           settle needs overshoot. */
        posRef.current += remaining * 0.16;
        paint();
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [indexAt, paint, setCentre]
  );

  const clamp = useCallback(
    (pos: number) => (loop ? pos : Math.max(0, Math.min(count - 1, pos))),
    [count, loop]
  );

  const goTo = useCallback(
    (index: number) => {
      /* Take the shorter way round rather than unwinding the whole ring. */
      const target = loop
        ? index + Math.round((targetRef.current - index) / count) * count
        : index;
      settle(clamp(target));
    },
    [clamp, count, loop, settle]
  );

  const nudge = useCallback(
    (by: number) => settle(clamp(Math.round(targetRef.current) + by)),
    [clamp, settle]
  );

  /* ---- dragging ---- */

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!ready || !count) return;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    /* NO pointer capture yet — see `onPointerMove`. */
    draggedRef.current = false;
    suppressClickRef.current = false;
    targetRef.current = posRef.current;

    /* Which cover was pressed, taken from the DOM rather than from a per-card
       handler. The frame sees every press, so one place knows both what was
       pressed and how far it then travelled — which is what deciding this on
       release requires. */
    const hit = (event.target as Element | null)?.closest?.("[data-cf-index]");
    const card = hit ? Number((hit as HTMLElement).dataset.cfIndex) : null;

    dragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      pos: posRef.current,
      v: 0,
      t: performance.now(),
      moved: 0,
      captured: false,
      card: Number.isInteger(card) ? card : null,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;

    const pitch = widthRef.current * (1 + gap);
    if (!pitch) return;

    drag.moved = Math.max(drag.moved, Math.abs(event.clientX - drag.x));

    /* UNDER THE THRESHOLD NOTHING HAPPENS AT ALL. A press with a shaky hand
       is not a drag: the deck must not move, and — the part that actually bit
       — the centre must not be rewritten. This used to run on the first pixel,
       so a two-pixel wobble while pressing a far cover set the centre to
       whichever card was nearest the deck's CURRENT position, and the click
       that followed compared itself against that invented centre, decided the
       card was already centred, and opened the note instead of travelling to
       it. Two pixels of hand movement changed what a click meant.

       Crossing the threshold rebases the gesture on where the pointer is now,
       so the deck starts from rest rather than jumping the slop's width. */
    if (!drag.captured) {
      if (drag.moved <= DRAG_SLOP) return;
      /* Capture only now, never on the press itself: the cards are links, and
         a captured pointer retargets the compatibility mouse events — the
         `click` among them — at the capturing element, which browsers do not
         agree on the timing of. A plain click never enters capture at all. */
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.captured = true;
      drag.x = event.clientX;
      drag.pos = posRef.current;
      drag.t = performance.now();
      return;
    }

    const now = performance.now();
    const previous = posRef.current;
    posRef.current = clamp(drag.pos - (event.clientX - drag.x) / pitch);
    /* Cards per second, for the throw. */
    drag.v = ((posRef.current - previous) / Math.max(now - drag.t, 1)) * 1000;
    drag.t = now;

    const index = indexAt(posRef.current);
    if (index !== centredRef.current) setCentre(index);
    paint();
  };

  /**
   * The release decides what the gesture was, and acts on it.
   *
   * Three outcomes, and only one of them lets the click through:
   *
   *   a DRAG            → settle where the throw lands, swallow the click
   *   an OFF-CENTRE tap → send that cover to the middle, swallow the click
   *   a CENTRED tap     → do nothing here, and let the link open the note
   */
  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;

    /* Where the deck actually ENDED UP, in cards, against where the press
       started it. Not how far the hand moved — see TAP_TRAVEL. */
    const travelled = Math.abs(posRef.current - drag.pos);
    const carried = Math.max(-2, Math.min(2, drag.v * 0.18));
    const isDrag = travelled >= TAP_TRAVEL || Math.abs(carried) >= 0.5;
    draggedRef.current = isDrag;

    if (isDrag) {
      /* Let a flick carry, but never more than two cards. */
      settle(clamp(Math.round(posRef.current + carried)));
      suppressClickRef.current = true;
      return;
    }

    /* The deck went nowhere, so this was a press on a cover. An off-centre one
       asks to SEE that record, not to open it — it is turned away and half
       faded, which is not enough of it to choose from. The centred one falls
       through to the link and opens its note. */
    if (drag.card !== null && drag.card !== centredRef.current) {
      goTo(drag.card);
      suppressClickRef.current = true;
      return;
    }

    /* A press that wandered and came back, on the card already centred: the
       deck must still land square rather than resting a few pixels off. */
    if (travelled > 0) settle(clamp(Math.round(posRef.current)));
  };

  /* ---- measuring ----
     Card width drives pitch, depth and perspective, so it is the only thing
     worth measuring — and only when the box actually changes. */
  useIsoLayoutEffect(() => {
    if (!ready) {
      setReady(true);
      return;
    }
    const frame = frameRef.current;
    if (!frame) return;

    const measure = () => {
      const card = cardRefs.current.find(Boolean);
      if (!card) return;
      widthRef.current = card.offsetWidth;
      paint();
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [ready, paint]);

  /* The deck is filtered from outside, so a new set of cards has to start at
     its own first card — leaving `pos` at 14 in a deck that now holds three
     would open on an empty stretch of ring. */
  const signature = items.map((i) => i.key).join("|");
  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    posRef.current = 0;
    targetRef.current = 0;
    setCentre(0);
    paint();
  }, [signature, paint, setCentre]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  if (count === 0) return null;

  return (
    <div className="coverflow" role="group" aria-roledescription="carousel" aria-label={label}>
      {/* Not a live region, unlike the caption. The centred record is what the
          deck announces as you move; the artist is already in every card's own
          accessible name, and reading a biography out on each step would bury
          it. */}
      {header && <div className="cf-header">{header(selected)}</div>}

      <div
        ref={frameRef}
        tabIndex={0}
        data-ready={ready ? "" : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            nudge(-1);
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            nudge(1);
          }
        }}
        className="cf-frame"
        style={{
          perspective: `calc(var(--cf-card) * ${perspective})`,
          /* Horizontal drag is ours; the page keeps vertical scrolling. */
          touchAction: "pan-y",
        }}
      >
        <div className="cf-stage">
          {items.map((item, index) => (
            <Link
              key={item.key}
              href={item.href}
              ref={(node) => {
                cardRefs.current[index] = node;
              }}
              className="cf-card"
              data-cf-index={index}
              aria-label={item.label}
              draggable={false}
              onFocus={(event) => {
                /* Tabbing to a card brings it to the centre — a focused thing
                   the reader cannot see is the one state focus must never be
                   left in.

                   KEYBOARD ONLY. A mouse press focuses the link too, and that
                   was the other half of why clicking a cover did nothing:
                   focus landed first and centred the card, so by the time the
                   click arrived the card WAS the centred one and the handler
                   below let it through to the note. `:focus-visible` is the
                   browser's own answer to "did this focus come from the
                   keyboard", which is exactly the question. */
                if (!ready) return;
                if (!event.currentTarget.matches(":focus-visible")) return;
                if (index !== centredRef.current) goTo(index);
              }}
              onClick={(event) => {
                /* A GATE, nothing more. `endDrag` already decided, on the
                   release, whether this gesture was allowed to open a note;
                   this only carries that out. Nothing here reads React state
                   or asks where the deck is, which is what used to make it
                   wrong.

                   `detail === 0` is a keyboard activation — Enter on a focused
                   cover — which never follows a drag and must always open. */
                if (event.detail !== 0 && suppressClickRef.current) {
                  event.preventDefault();
                }
                suppressClickRef.current = false;
              }}
            >
              {item.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.src}
                  srcSet={item.srcSet}
                  sizes="(min-width: 640px) 224px, 40vw"
                  alt=""
                  draggable={false}
                  /* Blur-up: the placeholder is the image's OWN background, so
                     the cover paints straight over it. See lib/blur.ts. */
                  style={
                    item.blur
                      ? {
                          backgroundImage: `url("${item.blur}")`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                />
              ) : (
                /* No cover: an empty surface square, so the deck keeps its
                   pitch and the caption still has a card to belong to. */
                <span className="cf-blank" aria-hidden="true" />
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Announced when the centred card changes, so someone driving this from
          the keyboard hears what they landed on rather than only seeing it.

          Its height is pinned by `.cf-caption` in globals.css rather than left
          to its contents: the page must not move under a reader stepping
          through the deck. Nothing sits below it, so the slack costs nobody
          anything. */}
      {caption && (
        <div className="cf-caption" aria-live="polite">
          {caption(selected)}
        </div>
      )}
    </div>
  );
}
