/**
 * How tall the last letter of a label is, so a mark set after it can be
 * centred on THAT letter rather than on the line.
 *
 * A chevron after a heading is read against the letter beside it. Centred on
 * the line it sits a little high after "Videos" (an x-height "s") and a little
 * low after "Shelf" (an "f" that reaches the top), and looks loose either
 * way. CSS has no way to ask what the neighbouring glyph is, so the label is
 * classified here at build time and the stylesheet does the rest with `ex`
 * and `cap` (see `.chev-fit` in app/globals.css).
 *
 * Three shapes are enough at heading sizes:
 *
 *   x     stays between the baseline and the x-height    a e o s  а о и
 *   tall  reaches the cap height or an ascender          A 7 d f l  Б б і
 *   deep  hangs below the baseline                       g p y  р у
 *
 * A letter with both an ascender and a descender ("ф", "j") centres about
 * where an x-height letter does, so it is `x`.
 */
export type LetterShape = "x" | "tall" | "deep";

const TALL = new Set([..."bdfhkltіїйґб"]);
const DEEP = new Set([..."gpqyру"]);

export function lastLetterShape(text: string): LetterShape {
  const chars = [...text.trim()];
  for (let i = chars.length - 1; i >= 0; i--) {
    const ch = chars[i];
    if (!/[\p{L}\p{N}]/u.test(ch)) continue;
    if (/\p{N}/u.test(ch)) return "tall";
    if (TALL.has(ch)) return "tall";
    if (DEEP.has(ch)) return "deep";
    // An uppercase letter: anything its own lowercase differs from.
    if (ch !== ch.toLowerCase()) return "tall";
    return "x";
  }
  return "x";
}

/**
 * The classes that fit a chevron to a bilingual label: one shape for the
 * English text and one for the Ukrainian, which the stylesheet picks between
 * on `html[data-lang]`. English stands in when there is no translation, as it
 * does in `components/T.tsx`.
 */
export function chevronFitClass(en: string, uk?: string): string {
  return `chev-fit chev-en-${lastLetterShape(en)} chev-uk-${lastLetterShape(uk ?? en)}`;
}
