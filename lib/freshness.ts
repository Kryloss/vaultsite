import type { Str } from "@/lib/ui-strings";
import { en, uk } from "@/lib/plural";

/**
 * How long ago the Now page was updated, from its `updated:` frontmatter
 * ("July 2026"), in whole calendar months. Page idea `nowFreshness`
 * (lib/site-config.ts → pageIdeas).
 *
 * Calendar months rather than days: the field only names a month, so
 * anything finer would be a precision the owner never wrote down.
 */

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** "July 2026" → { year: 2026, month: 6 } (month is 0-based). Null if unreadable. */
export function parseMonthYear(text: string): { year: number; month: number } | null {
  const match = /^\s*([A-Za-z]+)\s+(\d{4})\s*$/.exec(text);
  if (!match) return null;
  const month = MONTHS.indexOf(match[1].toLowerCase());
  if (month === -1) return null;
  return { year: Number(match[2]), month };
}

/**
 * Whole calendar months between `updated` and `now`. Null when the field
 * can't be read or names a month still to come — a label that says "in 2
 * months" would be answering a typo.
 */
export function monthsSince(updated: string, now: Date): number | null {
  const parsed = parseMonthYear(updated);
  if (!parsed) return null;
  const months =
    (now.getFullYear() - parsed.year) * 12 + (now.getMonth() - parsed.month);
  return months < 0 ? null : months;
}

/** The phrase that follows "Updated July 2026 ·", in both languages. */
export function freshnessLabel(months: number): Str {
  if (months === 0) return { en: "this month", uk: "цього місяця" };
  if (months === 1) return { en: "last month", uk: "минулого місяця" };
  if (months < 12) {
    return {
      en: `${en(months, "month", "months")} ago`,
      uk: `${uk(months, "місяць", "місяці", "місяців")} тому`,
    };
  }
  const years = Math.floor(months / 12);
  if (years === 1) return { en: "a year ago", uk: "рік тому" };
  return {
    en: `${en(years, "year", "years")} ago`,
    uk: `${uk(years, "рік", "роки", "років")} тому`,
  };
}
