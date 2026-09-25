/**
 * The shelf's search field (page idea `shelfSearch`, DECISIONS #180): what an
 * item is searchable by, and whether a query finds it.
 *
 * Pure and client-safe. The same word-prefix rule as the /music search
 * (lib/music-filter.ts): every word typed must begin some word of the item —
 * title or creator, in either language — so "harar" finds Sapiens by Harari
 * and "дюна" finds Dune by its Ukrainian title. Diacritics fold away.
 */
import { fold } from "@/lib/fuzzy";

function words(text: string): string[] {
  return fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** The haystack stored on each item, already folded and space-joined. */
export function shelfHaystack(parts: (string | undefined)[]): string {
  return [...new Set(parts.filter(Boolean).flatMap((p) => words(p!)))].join(" ");
}

export function shelfMatches(haystack: string, query: string): boolean {
  const wanted = words(query);
  if (wanted.length === 0) return true;
  const have = haystack.split(" ");
  return wanted.every((w) => have.some((h) => h.startsWith(w)));
}
