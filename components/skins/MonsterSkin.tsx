"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

/**
 * The Monster skin's markup and motion (`skin: monster`, DECISIONS #234).
 *
 * The note itself stays ordinary Markdown: headings, paragraphs, quotes,
 * tables, lists and image embeds, grouped by `<section class="mx-plate …">`.
 * `public/skins/monster.css` turns those into a dark page with lit screens and
 * pictures in it, and this file adds what a stylesheet cannot: the things
 * behind the title, type set INTO a picture, and each thing arriving as it
 * is scrolled to. It writes nothing to the page per frame; see the note at
 * the foot of the effect.
 *
 * Nothing here is needed to READ the note. With no script the page is the
 * same words and pictures, a heading under its picture instead of inside it,
 * standing still; everything that waits to be revealed is hidden only once
 * `data-mx="live"` says this component is running. Under reduced motion that
 * flag is never set and the smoke is one still frame.
 */

export interface SkinArt {
  src: string;
  srcSet?: string;
  width?: number;
  height?: number;
}

const SCOPE = '.page[data-skin="monster"]';

/* ---------------------------------------------------------------- smoke */

const VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";

/* Red smoke in a dark room: two rounds of domain-warped noise, lit only
   where a lamp behind the can would reach, then pushed through a black → red
   ramp with a little dither so it bands like bad tape rather than blending
   like a gradient. Most of the frame stays black on purpose.

   The last lines are the room's corners and its floor: black coming up from
   the foot, so the page below has nothing to be cut against, and the corners
   going dark. They were a sheet of two CSS gradients laid over the canvas,
   which was one more window-sized layer for the graphics card to lay down on
   every frame the hero was on screen; here they cost nothing. `u` runs 0 to 1
   from the bottom left. */
const FRAG = `
precision mediump float;
uniform vec2 r;uniform float t;uniform vec2 m;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
void main(){
vec2 p=(gl_FragCoord.xy-.5*r)/r.y;
p+=m*.05;
float tt=t*.045;
vec2 q=vec2(fbm(p*1.4+vec2(0.,tt)),fbm(p*1.4+vec2(5.2,-tt*1.3)));
float f=fbm(p*2.+2.7*q+vec2(tt*.6,tt*.25));
float lamp=exp(-dot(p*vec2(.62,.95),p*vec2(.62,.95))*2.1);
float v=smoothstep(.36,.9,f)*(.05+lamp*1.15);
v+=(h(gl_FragCoord.xy+fract(t)*91.7)-.5)*.06;
vec3 c=mix(vec3(.008,0.,0.),vec3(.95,.12,.04),smoothstep(.05,.85,v));
c=mix(c,vec3(1.,.72,.62),smoothstep(.9,1.25,v));
vec2 u=gl_FragCoord.xy/r;
float fl=u.y<.14?mix(1.,.82,u.y/.14):clamp(.82*(1.-(u.y-.14)/.3),0.,1.);
float d=length((u-vec2(.5,.54))/vec2(.78,.82));
float co=d<.3?0.:d<.78?.78*(d-.3)/.48:mix(.78,1.,clamp((d-.78)/.22,0.,1.));
float lit=(1.-fl)*(1.-co);
gl_FragColor=vec4(c*lit+vec3(.012)*(1.-lit),1.);
}`;

/** Starts the smoke on `canvas`; returns its teardown. `still` draws one frame. */
function startSmoke(canvas: HTMLCanvasElement, still: boolean): () => void {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
  if (!gl) return () => {};

  let uR: WebGLUniformLocation | null = null;
  let uT: WebGLUniformLocation | null = null;
  let uM: WebGLUniformLocation | null = null;
  /* Everything the context holds, made in one place, because a context can be
     taken away and handed back empty (see `lost` below). False when there is
     nothing to draw with. */
  const build = () => {
    if (gl.isContextLost()) return false;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(program, "a");
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    uR = gl.getUniformLocation(program, "r");
    uT = gl.getUniformLocation(program, "t");
    uM = gl.getUniformLocation(program, "m");
    return true;
  };

  /* Drawn small and stretched: smoke has no edges to keep, a soft upscale is
     most of the look, and a phone is spared a full-screen five-octave noise
     at its own pixel density. */
  const size = () => {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(0.5, Math.sqrt(230_000 / Math.max(1, rect.width * rect.height)));
    canvas.width = Math.max(2, Math.round(rect.width * scale));
    canvas.height = Math.max(2, Math.round(rect.height * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uR, canvas.width, canvas.height);
  };

  /* Thirty frames a second, whatever the screen's own rate. A frame of smoke
     is not the cost; having the whole hero put together again in front of it
     is, and smoke this slow looks the same at thirty as at a hundred and
     twenty. On a 120Hz screen that is a quarter of the work. */
  const STEP = 1000 / 30;
  let pointer = [0, 0];
  let eased = [0, 0];
  let raf = 0;
  let seen = true;
  let ready = false;
  let drawn = -Infinity;
  const start = performance.now();
  const frame = (now = performance.now()) => {
    raf = still || !ready || !seen || document.hidden ? 0 : requestAnimationFrame(frame);
    if (!ready) return;
    /* A little short of the step, so a 60Hz screen's every second frame
       (33.3ms, give or take) is not turned away. */
    if (now - drawn < STEP - 4) return;
    /* Eased by the clock, not by the frame: a fixed share per frame followed
       the pointer twice as fast on a screen twice as quick. */
    const k = 1 - Math.exp(-3 * Math.min(0.1, (now - drawn) / 1000));
    drawn = now;
    eased = [eased[0] + (pointer[0] - eased[0]) * k, eased[1] + (pointer[1] - eased[1]) * k];
    gl.uniform1f(uT, still ? 14 : (now - start) / 1000 + 14);
    gl.uniform2f(uM, eased[0], eased[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const wake = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  /* (Re)makes the program and draws. Without one the canvas is hidden and the
     hero's own black shows: a canvas with no context behind it is not always
     drawn black (Chrome has drawn it white). */
  const light = () => {
    ready = build();
    canvas.style.visibility = ready ? "" : "hidden";
    if (!ready) return;
    size();
    drawn = -Infinity;
    cancelAnimationFrame(raf);
    frame();
  };
  /* A browser may take the context away at any time (the graphics process
     restarted, too many contexts open across tabs, a tab left in the
     background) and nothing here used to answer: the smoke was gone until a
     reload. `preventDefault` is what asks for it back. */
  const lost = (event: Event) => {
    event.preventDefault();
    ready = false;
    canvas.style.visibility = "hidden";
  };
  canvas.addEventListener("webglcontextlost", lost);
  canvas.addEventListener("webglcontextrestored", light);

  light();

  const resize = new ResizeObserver(() => {
    if (!ready) return;
    size();
    /* A new size is an empty canvas: the next frame draws, due or not. */
    drawn = -Infinity;
    wake();
  });
  resize.observe(canvas);
  /* Off the screen it stops: the hero is one viewport of a long page. */
  const watch = new IntersectionObserver(([entry]) => {
    seen = entry.isIntersecting;
    if (seen) wake();
  });
  watch.observe(canvas);
  const onPointer = (event: PointerEvent) => {
    pointer = [(event.clientX / innerWidth) * 2 - 1, 1 - (event.clientY / innerHeight) * 2];
  };
  if (!still) {
    addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", wake);
  }

  return () => {
    cancelAnimationFrame(raf);
    resize.disconnect();
    watch.disconnect();
    canvas.removeEventListener("webglcontextlost", lost);
    canvas.removeEventListener("webglcontextrestored", light);
    removeEventListener("pointermove", onPointer);
    document.removeEventListener("visibilitychange", wake);
    /* The context is given up only with the canvas. This also runs when the
       effect is run again on the SAME canvas (a development refresh), and a
       context thrown away there is the one the next start is handed back:
       lost, and silent about it. */
    if (!canvas.isConnected) gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
}

/* --------------------------------------------------------------- frames */

/**
 * Type set into a picture. A figure directly followed by a `##` or a `>`
 * takes that block in as its own, so the words stand IN the photograph the
 * way a title stands in a film frame, not under it like a caption.
 *
 * Then the picture's bottom band is drawn once more, in front of the words
 * and feathered at its top edge: the letters' feet go behind the ground the
 * photograph already has, which is what makes them read as standing in the
 * scene. A `div` with a background, not a second `<img>`: the lightbox
 * gathers every image in the note, and would count the copy.
 *
 * Returns its teardown. Safe to run twice on the same note: a figure already
 * composed keeps its copy and is only listened to again.
 */
function composeFrames(root: HTMLElement): () => void {
  const fores: Array<[HTMLImageElement, HTMLElement]> = [];
  root.querySelectorAll<HTMLElement>(".prose figure").forEach((figure) => {
    const img = figure.querySelector<HTMLImageElement>("img");
    if (!img) return;
    let fore = figure.querySelector<HTMLElement>(":scope > .mx-fore");
    if (!fore) {
      const next = figure.nextElementSibling;
      if (!next || !next.matches("h2, blockquote")) return;
      figure.classList.add("mx-frame");
      figure.append(next);
      fore = document.createElement("div");
      fore.className = "mx-fore";
      fore.setAttribute("aria-hidden", "true");
      figure.append(fore);
    }
    fores.push([img, fore]);
  });
  /* The copy is whichever file the browser chose for the picture, and is
     moved to the next one when a wider window has it choose again. */
  const paint = () => {
    for (const [img, fore] of fores) {
      const src = img.currentSrc || img.src;
      if (src) fore.style.backgroundImage = `url("${src}")`;
    }
  };
  for (const [img] of fores) img.addEventListener("load", paint);
  paint();
  return () => {
    for (const [img] of fores) img.removeEventListener("load", paint);
  };
}

/* ---------------------------------------------------------------- words */

/**
 * Wraps every word of `el` in `<span class="mx-w"><span>…</span></span>` so
 * the stylesheet can land them one at a time. Text nodes only, so a heading's
 * `#` anchor and any inline markup keep their place. Only ever called on the
 * rendered note body, which React injects once and never reconciles.
 */
function splitWords(el: Element) {
  if (el.querySelector(".mx-w")) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.data.trim() && !node.parentElement?.closest(".heading-anchor")) texts.push(node);
  }
  let index = 0;
  for (const text of texts) {
    const fragment = document.createDocumentFragment();
    for (const part of text.data.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        fragment.append(" ");
        continue;
      }
      const outer = document.createElement("span");
      outer.className = "mx-w";
      outer.style.setProperty("--i", String(index++));
      const inner = document.createElement("span");
      inner.textContent = part;
      outer.append(inner);
      fragment.append(outer);
    }
    text.replaceWith(fragment);
  }
}

/* ------------------------------------------------------------------ art */

/**
 * How wide the can is drawn, as a `sizes` the browser can read before any
 * stylesheet has loaded: the stand's height in `public/skins/monster.css`
 * (`.mx-stand`) times the picture's own shape (`ar`, width over height).
 *
 * The stand is `min(86vh, 52.5vw)` high in a landscape window from 600px and
 * `min(92vh, 190vw)` in any other, and those four numbers are kept in step
 * with the stylesheet by hand. Each `min()` is written as a media condition
 * (86vh is the smaller once the window is wider than 86/52.5 of its height),
 * because a math function in `sizes` is not read everywhere.
 *
 * It said "26vw, 80vw", a little more than the truth, and that little was
 * the difference between the 672px copy and the full-size one on a laptop.
 */
function artSizes(ar: number): string {
  const landscape = "(min-width: 600px) and (min-aspect-ratio: 1/1)";
  return [
    `${landscape} and (min-aspect-ratio: 860/525) ${(86 * ar).toFixed(1)}vh`,
    `${landscape} ${(52.5 * ar).toFixed(1)}vw`,
    `(min-aspect-ratio: 92/190) ${(92 * ar).toFixed(1)}vh`,
    `${(190 * ar).toFixed(1)}vw`,
  ].join(", ");
}

/* ------------------------------------------------------------ component */

export default function MonsterSkin({ beats, art }: { beats: string[]; art?: SkinArt }) {
  const smoke = useRef<HTMLCanvasElement>(null);
  const can = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(SCOPE);
    if (!root) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const undo: Array<() => void> = [];

    /* The smoke is decoration: a browser that hands back a context it cannot
       draw with gets a dark room, not a page that failed to mount. */
    if (smoke.current) {
      try {
        undo.push(startSmoke(smoke.current, still));
      } catch {}
    }

    /* The light on the can is cut to the can by a mask of the can's own
       picture (`.mx-stand::after`). Named here, once the browser has chosen
       a file, so the mask IS that file. Named in the markup it was always
       the original: half a megabyte fetched beside the smaller copy the
       <img> had picked. */
    const artImg = can.current;
    if (artImg) {
      const light = () => {
        const src = artImg.currentSrc || artImg.src;
        if (src && artImg.naturalWidth) artImg.closest<HTMLElement>(".mx-can")?.style.setProperty("--mx-art", `url("${src}")`);
      };
      artImg.addEventListener("load", light);
      light();
      undo.push(() => artImg.removeEventListener("load", light));
    }

    /* Layout, not motion, so it happens with reduced motion too. */
    undo.push(composeFrames(root));

    /* A content image is told how wide it really is. The pipeline's `sizes`
       describes the site's 39rem column; here a picture runs the width of the
       window, and would otherwise be drawn from a file half as wide.

       Observed, not measured once: the note is on the page in both
       languages, the one not showing has no width to measure, and switching
       to it fires no `resize`. Its pictures used to keep the column's
       `sizes` and come up soft.

       The width of the BOX, on purpose. On a phone the frame is taller than
       the photograph is, the crop draws it twice as wide as the window, and
       an honest number would fetch the 2400px original for every picture:
       three megabytes for sharpness that the grain hides. */
    const sized = new ResizeObserver((entries) => {
      for (const { target, contentRect } of entries) {
        const width = Math.round(contentRect.width);
        if (width > 0) (target as HTMLImageElement).sizes = `${width}px`;
      }
    });
    root.querySelectorAll<HTMLImageElement>(".prose figure img[srcset]").forEach((img) => sized.observe(img));
    undo.push(() => sized.disconnect());

    if (still) return () => undo.forEach((fn) => fn());

    /* ---- From here on: motion. ---- */

    root.querySelectorAll(".prose h2, .prose blockquote p").forEach(splitWords);

    /* Reveal once, a little after the thing has crossed into the window. */
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.replace("mx-hold", "mx-in");
          reveal.unobserve(entry.target);
        }
      },
      /* From a little BELOW the window, and at the first pixel. It used to
         wait until the thing was 7% up the window and a twentieth of it was
         in view. The observer reports on the main thread, the scroll does
         not wait for it, and on a busy page that report can be late: late
         from inside the window was a screen of nothing, and of a tall plate
         a twentieth is a long way. */
      { rootMargin: "0px 0px 12% 0px", threshold: 0 }
    );
    /* Only what is still below the window waits. This chunk can arrive after
       the reader has started down the page, or the page can open part-way
       down it (a reload, a link to a heading): what is already on screen
       must not blink out to make an entrance, and what is above must not be
       left dark. The language that is not showing has no box at all, and
       waits to be shown. */
    const waiting = [
      ...root.querySelectorAll(
        ".prose .mx-plate, .prose h2, .prose p, .prose li, .prose blockquote, .prose table, .prose figure"
      ),
    ].filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.top >= innerHeight || (rect.width === 0 && rect.height === 0);
    });
    for (const el of waiting) {
      el.classList.add("mx-hold");
      reveal.observe(el);
    }
    undo.push(() => reveal.disconnect());
    root.dataset.mx = "live";
    undo.push(() => delete root.dataset.mx);

    /* Nothing here writes to the page per frame. A scroll-speed variable on
       the page root (to stretch the type) and a pointer one (to lean the
       can) were both built: each re-styled the whole note on every frame,
       and the first re-ran the headline filter with it. The scroll is left
       to the compositor. */
    return () => undo.forEach((fn) => fn());
  }, []);

  return (
    <>
      {/* The opening: one word a screen, then the last word is pulled out
          into streaks and the dark gives way to the title. Decoration only,
          and it lets every click and scroll through, so nobody has to sit it
          out. */}
      {beats.length > 0 && (
        <div className="mx-intro" data-n={beats.length} aria-hidden="true">
          {beats.map((word, i) => (
            <span key={i} className="mx-beat" style={{ "--i": i } as CSSProperties}>
              {/* Two elements for two movements: the word lands on the inner
                  one and the last word is pulled out on the outer. Both on
                  one element, neither runs on the compositor. */}
              <b>
                <span>{word}</span>
              </b>
            </span>
          ))}
        </div>
      )}

      {/* Behind the title: smoke and the dark. */}
      <div className="mx-hero" aria-hidden="true">
        <canvas ref={smoke} className="mx-smoke" />
      </div>

      {/* In FRONT of the title: the thing photographed, cut out of its
          backdrop (`skin_art:`, a file with an alpha channel), so the title
          passes behind it. */}
      {art && (
        <div
          className="mx-can"
          aria-hidden="true"
          style={{ "--mx-ar": art.width && art.height ? art.width / art.height : undefined } as CSSProperties}
        >
          {/* Two boxes on purpose. `.mx-stand` is the can's place and shape;
              `.mx-lit` inside it carries the shadow, the mask and the light,
              so all three are drawn once into the picture the scroll moves. */}
          <div className="mx-stand">
            <div className="mx-lit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={can}
              className="mx-art"
              src={art.src}
              srcSet={art.srcSet}
              sizes={artSizes(art.width && art.height ? art.width / art.height : 0.45)}
              width={art.width}
              height={art.height}
              alt=""
              fetchPriority="high"
            />
            </div>
          </div>
        </div>
      )}

      {/* Scanlines and the vignette, over the whole window. */}
      <div className="mx-fx" aria-hidden="true" />
    </>
  );
}
