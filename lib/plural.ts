import type { Str } from "@/lib/ui-strings";

/**
 * Counted nouns in both languages.
 *
 * English has two forms and Ukrainian has three, which is why a counted phrase
 * can't be assembled inline the way a fixed string can — `lib/ui-strings.ts`
 * holds pairs of finished sentences, and "14 notes" isn't one until you know
 * the 14. The constellation showed "13 липня 2026 р. · 11" for a while for
 * exactly that reason: the noun had nowhere to come from, so it was left out.
 */

/**
 * Which of Ukrainian's three forms a number takes.
 *
 *   one   1, 21, 31 …          нотатка
 *   few   2–4, 22–24 …         нотатки
 *   many  0, 5–20, 25–30 …     нотаток
 *
 * The teens are the exception that catches everyone: 11–14 look like they
 * should take `one` and `few` by their last digit, and they don't.
 */
export function ukForm(n: number): "one" | "few" | "many" {
  const abs = Math.abs(Math.trunc(n));
  const tens = abs % 100;
  if (tens >= 11 && tens <= 14) return "many";
  const unit = abs % 10;
  if (unit === 1) return "one";
  if (unit >= 2 && unit <= 4) return "few";
  return "many";
}

/** `n` and the right form of a Ukrainian noun. */
export function uk(n: number, one: string, few: string, many: string): string {
  const form = ukForm(n);
  return `${n} ${form === "one" ? one : form === "few" ? few : many}`;
}

/** `n` and the right form of an English noun. */
export function en(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "14 notes" / "14 нотаток", ready for `<T>`. */
export function noteCount(n: number): Str {
  return {
    en: en(n, "note", "notes"),
    uk: uk(n, "нотатка", "нотатки", "нотаток"),
  };
}

/** "1 playlist" / "1 плейлист", ready for `<T>`. */
export function playlistCount(n: number): Str {
  return {
    en: en(n, "playlist", "playlists"),
    uk: uk(n, "плейлист", "плейлисти", "плейлистів"),
  };
}
