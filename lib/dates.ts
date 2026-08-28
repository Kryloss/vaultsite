/**
 * Date formatting with no filesystem behind it.
 *
 * Separate from `lib/vault.ts` — which also formats dates — because that
 * module reads the vault, so importing it from anything that reaches the
 * browser pulls `fs` into the client bundle and the build stops. This one is
 * pure, so a client component can use it.
 *
 * `components/lists/PostRows.tsx` is the case that proves it: a server
 * component, but rendered by `PostListClient`, so it ships to the browser and
 * cannot import from the vault. It kept a private copy of this function for
 * that reason; the copy has been promoted here rather than made a third time
 * for the sidebar constellation.
 */

/**
 * "2026-07-16" → "16.07".
 *
 * The same in both languages, so it needs no `<T>` — which is most of why it
 * gets used wherever a column is too narrow for a month's name: the posts
 * list's rows, and the constellation's hover label in the sidebar.
 */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  if (!m || !d) return iso;
  return `${d}.${m}`;
}

/**
 * "2026-07-16" → "July 16, 2026" (UTC-safe, no timezone drift).
 *
 * Moved here from `lib/vault.ts` for the same reason `shortDate` never lived
 * there: the /music list became a client component when it gained a search box
 * and a language filter, and a client component that reaches for the vault
 * pulls `fs` into the browser bundle. `lib/vault.ts` re-exports both names, so
 * every existing caller is untouched.
 */
export function displayDate(iso: string, locale = "en-US"): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "2026-07-16" → "16 липня 2026 р." (Ukrainian long date). */
export function displayDateUk(iso: string): string {
  return displayDate(iso, "uk-UA");
}
