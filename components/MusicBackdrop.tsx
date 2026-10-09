"use client";

import { useEffect, useRef } from "react";
import geometry from "@/lib/music-backdrop.json";
import {
  advance,
  forkOffset,
  pose,
  start,
  type Levitation,
  type LevitationParams,
} from "@/lib/levitation";

/**
 * SpongeBob levitating beside the /music player (DECISIONS #199).
 *
 * Two pictures, cut where the headphone cord forks by
 * scripts/make-music-backdrop.py: him, and the cord and iPod below the fork.
 * The physics is lib/levitation.ts — he floats on soft springs toward random
 * targets, and the cord hangs from the fork as a real damped pendulum driven
 * by how the fork actually moves. This file only measures the page, runs the
 * simulation once per frame and writes two `transform`s.
 *
 * Server-rendered as the whole picture at rest; nothing moves until this
 * hydrates, and nothing moves at all below 1168px (he is `display: none`),
 * under reduced motion, in a hidden tab, or while he is scrolled out of view.
 */

const { width: W, height: H, cord, pivot, bob } = geometry;
/** Where he turns about, as a share of his box. */
const TURN = { x: 0.5, y: 0.2 };
/** The angle the picture draws the cord at, from plumb (rad, + = right). */
const DRAWN = Math.atan2(bob.x - pivot.x, bob.y - pivot.y);
const pct = (n: number) => `${n * 100}%`;

export default function MusicBackdrop() {
  const box = useRef<HTMLDivElement>(null);
  const him = useRef<HTMLImageElement>(null);
  const hang = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const boxEl = box.current;
    const himEl = him.current;
    const hangEl = hang.current;
    if (!boxEl || !himEl || !hangEl) return;

    const wide = window.matchMedia("(min-width: 1168px)");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    let params: LevitationParams | null = null;
    let state: Levitation | null = null;
    let onScreen = false;
    let raf = 0;
    let last = 0;
    let carry = 0;

    const measure = () => {
      const scale = himEl.offsetWidth / W;
      if (!scale) return;
      const rect = boxEl.getBoundingClientRect();
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const top = rect.top + window.scrollY;
      const height = himEl.offsetHeight;
      // He sinks until the iPod is 2rem short of the album covers.
      const covers = document.querySelector(".cf-stage");
      const floor = covers
        ? covers.getBoundingClientRect().top + window.scrollY
        : top + height * 1.3 + 2 * rem;
      params = {
        range: Math.max(0, floor - top - height - 2 * rem),
        fork: { x: (pivot.x - TURN.x * W) * scale, y: (pivot.y - TURN.y * H) * scale },
        length: Math.hypot(bob.x - pivot.x, bob.y - pivot.y) * scale,
        room: {
          // Left: the 2rem to the text column. Right: to the window's edge.
          left: 2 * rem,
          right: Math.max(0, document.documentElement.clientWidth - rect.right),
        },
      };
      state ??= start(params, Math.random, DRAWN);
    };

    const draw = () => {
      if (!state || !params) return;
      const p = pose(state);
      himEl.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.lean}rad)`;
      // The cord is hung from wherever the fork has got to, and turned from
      // the angle it is drawn at to the angle it is swinging at.
      const fork = forkOffset(state, params);
      hangEl.style.transform = `translate(${fork.x}px, ${fork.y}px) rotate(${DRAWN - state.swing}rad)`;
    };

    const frame = (now: number) => {
      if (state && params) {
        const elapsed = last ? (now - last) / 1000 : 0;
        carry = advance(state, params, Math.random, elapsed + carry);
        draw();
      }
      last = now;
      raf = requestAnimationFrame(frame);
    };

    const update = () => {
      const moving = wide.matches && !still.matches && onScreen && !document.hidden;
      if (moving && !raf) {
        measure();
        last = 0;
        raf = requestAnimationFrame(frame);
      } else if (!moving && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      if (!wide.matches || still.matches) {
        // Back to the picture at rest, and a fresh start next time.
        state = null;
        himEl.style.transform = "";
        hangEl.style.transform = "";
      }
    };

    // A window's height of margin: his box stays where he rests, but he may
    // have sunk into view below it.
    const seen = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        update();
      },
      { rootMargin: "100% 0px" },
    );
    seen.observe(boxEl);
    // The page settles after hydration (the cover deck lays itself out), and
    // a resize moves the covers and his size: measure again whenever the
    // document's box changes.
    const resized = new ResizeObserver(() => {
      if (raf) measure();
    });
    resized.observe(document.documentElement);
    wide.addEventListener("change", update);
    still.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);

    return () => {
      cancelAnimationFrame(raf);
      seen.disconnect();
      resized.disconnect();
      wide.removeEventListener("change", update);
      still.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <div ref={box} className="music-backdrop" aria-hidden="true">
      {/* Decorative (`alt=""`); lazy so that below 1168px, where this is
          `display: none`, neither picture is ever fetched. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={him}
        className="music-backdrop-body"
        src="/art/music-backdrop.webp"
        alt=""
        width={W}
        height={H}
        loading="lazy"
        decoding="async"
        style={{ transformOrigin: `${pct(TURN.x)} ${pct(TURN.y)}` }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={hang}
        className="music-backdrop-cord"
        src="/art/music-backdrop-cord.webp"
        alt=""
        width={cord.width}
        height={cord.height}
        loading="lazy"
        decoding="async"
        style={{
          left: pct(cord.left / W),
          top: pct(cord.top / H),
          width: pct(cord.width / W),
          transformOrigin: `${pct((pivot.x - cord.left) / cord.width)} ${pct((pivot.y - cord.top) / cord.height)}`,
        }}
      />
    </div>
  );
}
