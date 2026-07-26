/**
 * Trigram similarity — the "did you mean" behind the 404 page and the Cmd+K
 * palette's no-results fallback.
 *
 * Character trigrams catch transpositions and dropped letters
 * ("certifcation" → "certification") that substring matching misses entirely,
 * and they work on Cyrillic as readily as Latin, which matters here. A real
 * fuzzy-search library would do this better; twenty lines does it well enough
 * for a site this size and adds no dependency.
 */

/** Cyrillic is kept alongside Latin — half this site is Ukrainian. */
const NOT_WORD = /[^a-z0-9Ѐ-ӿ]+/g;

export function trigrams(value: string): Set<string> {
  // Padding makes the first and last letters count, so a wrong initial is felt.
  const padded = ` ${value.toLowerCase().replace(NOT_WORD, " ").trim()} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

/** 0–1 overlap between two strings' trigrams. */
export function similarity(a: string, b: string): number {
  const A = trigrams(a);
  const B = trigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const gram of A) if (B.has(gram)) shared++;
  // Divide by the larger set so a short query can't score highly against
  // every long title just by being a subset of it.
  return shared / Math.max(A.size, B.size);
}
