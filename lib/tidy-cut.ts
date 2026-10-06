/**
 * Where a shortened sentence should end, and with what.
 *
 * The browser's own ellipsis (`text-overflow`, `-webkit-line-clamp`) cuts at
 * whatever character stops fitting, so a description shortened on a phone can
 * end "…for a year, …" or "…the one thing (…": the mark lands after
 * punctuation that only made sense with the words that followed it. CSS has no
 * say in where the cut falls, so components/ClampTidy.tsx does the cut itself
 * and asks this for the text. DECISIONS #217.
 *
 * Pure, so it is tested (lib/tidy-cut.test.ts).
 */

export const ELLIPSIS = "…";

/* What may not be left standing before the ellipsis: spaces, the joining
   punctuation, dashes, and an opening bracket or quote with nothing in it.
   A full stop, "!" and "?" are left alone — they end a sentence, and
   "word.…" does not come up because the cut steps back a whole word. */
const DANGLING = /[\s,;:·•—–\-([{«„“‘"']+$/u;

/**
 * `text` shortened to at most `limit` characters, ending on a whole word with
 * no dangling punctuation, and the ellipsis after it. Returns `text` itself
 * when the limit doesn't shorten it.
 */
export function tidyCut(text: string, limit: number): string {
  if (limit >= text.length) return text;
  let cut = text.slice(0, Math.max(0, limit));
  // Mid-word: step back to the word's start, unless that would leave nothing
  // (one long word, a URL) — then the broken word is the lesser evil.
  if (/\S/.test(text[cut.length] ?? "") && /\S$/.test(cut)) {
    const space = cut.search(/\s\S*$/);
    if (space > 0) cut = cut.slice(0, space);
  }
  return cut.replace(DANGLING, "") + ELLIPSIS;
}
