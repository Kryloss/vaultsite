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
 * "2026-07-16" → "16.07.2026".
 *
 * `shortDate` with its year, for a column of dates from different years: the
 * home page's Recent posts. A month's name makes every date a different
 * width, so a right-aligned column has a ragged left edge ("6 вересня" beside
 * "25 липня"); these are all the same width under `tabular-nums` and line up
 * on both sides (#226). The same in both languages, like `shortDate`.
 */
export function numericDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

/**
 * The formatter for ONE column of dates: without the year while every date in
 * the column falls in the same year ("06.09"), with it for all of them as
 * soon as a second year appears ("06.09.2026").
 *
 * A year repeated down a column says nothing, so it is left out until it
 * starts to tell rows apart (#227). All or none: a column where only some
 * rows carry a year is two widths, and the ragged edge is back. Undated
 * entries are ignored when deciding.
 */
export function columnDate(isos: (string | undefined)[]): (iso: string) => string {
  const years = new Set(
    isos.map((iso) => iso?.split("-")[0]).filter((y): y is string => Boolean(y))
  );
  return years.size > 1 ? numericDate : shortDate;
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
