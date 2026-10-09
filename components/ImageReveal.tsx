/**
 * A picture sharpens into place as it appears (DECISIONS #231): blurred, a
 * touch bright and a hair large, settling over 0.7s. The blur placeholder is
 * the image's own background, so the first frame looks like what was already
 * there.
 *
 * An inline script in <head>, like the language and intro gates beside it,
 * because only that is early enough: the first screen's images finish loading
 * long before React hydrates, and those are the ones a visitor is looking at.
 * `load` does not bubble but can be caught on the way down, so one listener
 * covers every `<img>` on the site, build-time HTML included, and follows
 * `loading="lazy"` with no code of its own: a shelf row reveals the covers on
 * screen and the rest as they are scrolled to.
 *
 * It runs the animation with `element.animate()` and writes nothing to the
 * DOM. An attribute or class set here would sit on server-rendered markup
 * before hydration and trip React's mismatch warning. That is also why the
 * numbers are in this file and not in globals.css: 700ms and `ease-in-out`
 * are the reveal's own, not the `--dur-*` scale.
 *
 * The browser fetches a lazy image well before it is on screen, so one that
 * loads outside the viewport waits for an IntersectionObserver and plays as it
 * is scrolled in; otherwise the reveal would be over before anyone saw it.
 *
 * Nothing waits for it: an image is visible the moment the browser paints it,
 * script or no script. Each element is revealed once (`__rv`), a press cancels
 * it so the lightbox never zooms from a half-blurred picture, and it does not
 * run under `prefers-reduced-motion`. Skipped: SVGs and data URLs (line art
 * going soft reads as a glitch), anything painted under 48px, and any subtree
 * marked `data-no-reveal`.
 */
const SCRIPT =
  "(function(){try{var m=matchMedia('(prefers-reduced-motion: reduce)');" +
  "var p=function(i){i.__rv=i.animate([" +
  "{filter:'blur(15px) brightness(1)',scale:'1.0125'}," +
  "{filter:'blur(10px) brightness(1.25)',offset:0.1}," +
  "{filter:'blur(0px) brightness(1)',scale:'1'}" +
  "],{duration:700,easing:'ease-in-out'})};" +
  "var o=window.IntersectionObserver&&new IntersectionObserver(function(l){l.forEach(function(x){if(x.isIntersecting){o.unobserve(x.target);p(x.target)}})});" +
  "document.addEventListener('load',function(e){var i=e.target;" +
  "if(!i||i.tagName!=='IMG'||i.__rv||m.matches||!i.animate)return;" +
  "var s=i.currentSrc||i.src||'';" +
  "if(/^data:|\\.svg([?#]|$)/i.test(s)||i.clientWidth<48||i.closest('[data-no-reveal]'))return;" +
  "var r=i.getBoundingClientRect();i.__rv=1;" +
  "if(!o||(r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth))p(i);else o.observe(i)},true);" +
  "document.addEventListener('pointerdown',function(e){var a=e.target&&e.target.__rv;if(a&&a.cancel)a.cancel()},true)" +
  "}catch(e){}})()";

export default function ImageReveal() {
  return <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
