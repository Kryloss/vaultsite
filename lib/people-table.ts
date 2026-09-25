/**
 * The People page's Table view (page idea `peopleTable`, DECISIONS #180):
 * two columns lifted from each person's own "At a glance" fact table, and the
 * year a "Born" column sorts by.
 *
 * Pure and client-safe. The fact rows come from lib/music-facts.ts →
 * factRows(), the same reader the music deck uses, so a table is found by
 * the one rule the renderer uses too.
 */
import { factRows } from "@/lib/music-facts";
import type { Str } from "@/lib/ui-strings";

export interface PersonFacts {
  born?: Str;
  knownFor?: Str;
}

/** A fact value as plain text — no emphasis marks, no link syntax. */
function plain(value: string): string {
  return value
    .replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_m, t, l) => l || t)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|\*|__|_|`)/g, "")
    .trim();
}

/**
 * "Born" (or "Formed", for a band) and "Known for", matched on the ENGLISH
 * label and read in Ukrainian from the same position — the merge rule
 * lib/music-facts.ts uses, including its fallback: tables of different
 * lengths give English for both.
 */
export function personFacts(content: string, contentUk?: string): PersonFacts {
  const en = factRows(content);
  const ukRows = contentUk ? factRows(contentUk) : [];
  const uk = ukRows.length === en.length ? ukRows : [];
  const pick = (test: RegExp): Str | undefined => {
    const i = en.findIndex((r) => test.test(r.label.trim()));
    if (i === -1) return undefined;
    const value = plain(en[i].value);
    return { en: value, uk: uk[i] ? plain(uk[i].value) : value };
  };
  return {
    born: pick(/^(born|formed)$/i),
    knownFor: pick(/^known for$/i),
  };
}

/** The first plausible year in a value — "June 14, 1946 — Queens" → 1946. */
export function yearOf(value: string | undefined): number | null {
  const m = value ? /\b(1[5-9]\d{2}|20\d{2})\b/.exec(value) : null;
  return m ? Number(m[1]) : null;
}
