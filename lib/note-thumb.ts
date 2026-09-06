/**
 * The note thumbnail's RESERVE — the offset the title is held at while the
 * artwork stands beside it (DECISIONS #133, #134).
 *
 * CSS sizes the picture on its own: `height: 100%` against a header whose
 * height is the type's, `width: auto` through the artwork's ratio, so its foot
 * always lands on the date line and it is never cropped vertically. What CSS
 * cannot then do is tell the TITLE how wide that picture came out — the
 * offset is what decides how the title wraps, the wrap decides how tall the
 * header is, and the height is what the picture's width was derived from.
 * That is a cycle, and CSS refuses cycles: the reserve has to be one constant
 * (6rem, the widest the picture is ever drawn), which leaves up to 40px of
 * slack between a short-titled note's narrow cover and its title.
 *
 * So the reserve is MEASURED, once the browser has drawn the picture. This is
 * the only measurement in the header and it reads one number: the width the
 * artwork actually came out at.
 *
 * IT SETTLES RATHER THAN OSCILLATING, and that is worth stating because #131
 * shipped a cyclic layout that did not. Narrowing the reserve gives the title
 * MORE room, so the header can only get shorter, so the picture can only get
 * narrower — the pass is monotone downward and stops. The other direction is
 * bounded too: a window that narrows makes the title taller and the picture
 * wider, and `max-width` stops that at `--note-thumb-w`, which is the reserve
 * the page starts from. Nothing here can widen past where CSS alone put it.
 *
 * No-JS, and any moment before this runs, is the CSS answer: the full 6rem
 * reserve, correct in every other way. This narrows the gap; it is not what
 * holds the layout up.
 */
export function fitNoteThumb(header: HTMLElement): void {
  const thumb = header.querySelector<HTMLElement>(".note-thumb");
  if (!thumb) return;

  /* Four passes, because narrowing the reserve can un-wrap a line of the
     title, which shortens the header, which narrows the picture again. Each
     pass is a synchronous measure-and-write inside one frame, so the reader
     never sees an intermediate step; in practice it settles on the first or
     second. */
  for (let pass = 0; pass < 4; pass++) {
    const width = thumb.getBoundingClientRect().width;
    /* No box at all — the thumbnail is `display: none` because a gutter is
       showing the same artwork (1168px for a person, 1400px for a poster).
       The media queries zero the reserve themselves; drop the measurement so
       nothing stale is waiting when the window comes back. */
    if (!width) {
      header.style.removeProperty("--note-thumb-fit");
      return;
    }
    const fitted = parseFloat(header.style.getPropertyValue("--note-thumb-fit"));
    if (Math.abs(width - fitted) < 1) return;
    header.style.setProperty("--note-thumb-fit", `${width}px`);
  }
}

/**
 * The same measurement, inline, for the FIRST PAINT of a hard load.
 *
 * The component below runs at hydration, which is a frame or three after the
 * server's HTML is on screen — long enough to watch the title slide left. The
 * site already splits this work the same way for the intro (a gate script in
 * the layout, a client half for soft navigations); this is that pattern with
 * one statement in it. Placed immediately after the header, it runs while the
 * parser is still working, so the offset is right the first time the page is
 * drawn.
 *
 * One pass only, deliberately: the loop above exists for the case where the
 * narrower reserve un-wraps the title, and a second layout during parsing
 * costs more than the pixel it saves. `fitNoteThumb` finishes the job at
 * hydration. Keep the two in step — they read the same element and write the
 * same property.
 */
export const NOTE_THUMB_FIT_SCRIPT =
  "try{var h=document.querySelector('.note-header');var t=h&&h.querySelector('.note-thumb');var w=t&&t.getBoundingClientRect().width;if(w)h.style.setProperty('--note-thumb-fit',w+'px');}catch(e){}";
