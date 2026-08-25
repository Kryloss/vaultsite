/**
 * Ukrainian national observances — the days the sidebar's counter steps aside
 * for (see components/ResistanceDay.tsx).
 *
 * "Day N of Ukraine's resistance" is a running total, and a running total is
 * the wrong sentence on both kinds of day here: on Independence Day it answers
 * a question nobody asked, and on Holodomor Remembrance Day it measures the
 * war on a day that is about something else entirely.
 *
 * TWO KINDS, and the difference is the whole design. A `celebration` takes the
 * flag's colours; a `remembrance` never does — it goes monochrome, which is
 * also the site's own register for emphasis. Flag colours on a day of mourning
 * would say the wrong thing. `kind` is the only thing that decides which, so
 * adding a day is one row and nothing else.
 *
 * Computed from the READER'S local calendar date, the same components the day
 * counter reads. The site is fully static, so the build-time answer is passed
 * into the sidebar as a prop and re-checked in the browser.
 */
export type ObservanceKind = "celebration" | "remembrance";

export type ObservanceId =
  | "unity"
  | "heavenlyHundred"
  | "invasion"
  | "chornobyl"
  | "victoryOverNazism"
  | "vyshyvanka"
  | "mourning"
  | "constitution"
  | "flag"
  | "independence"
  | "fallenDefenders"
  | "defenders"
  | "holodomor"
  | "dignity"
  | "armedForces";

type Row = {
  id: ObservanceId;
  kind: ObservanceKind;
  /** Month, 0-based — the same convention `Date` uses. */
  month: number;
  /** Day of the month, for a date that doesn't move. */
  day?: number;
  /** For a date that does: the nth (weekday) of that month. 4 = Thursday. */
  nth?: { weekday: number; n: number };
};

/**
 * Every day the line changes, in calendar order.
 *
 * 20 February is both the Heavenly Hundred and the date the counter itself
 * starts from (lib/resistance.ts) — day 1 names itself.
 */
const DAYS: readonly Row[] = [
  { id: "unity", kind: "celebration", month: 0, day: 22 },
  { id: "heavenlyHundred", kind: "remembrance", month: 1, day: 20 },
  { id: "invasion", kind: "remembrance", month: 1, day: 24 },
  { id: "chornobyl", kind: "remembrance", month: 3, day: 26 },
  { id: "victoryOverNazism", kind: "remembrance", month: 4, day: 8 },
  // Vyshyvanka Day — the third Thursday of May.
  { id: "vyshyvanka", kind: "celebration", month: 4, nth: { weekday: 4, n: 3 } },
  { id: "mourning", kind: "remembrance", month: 5, day: 22 },
  { id: "constitution", kind: "celebration", month: 5, day: 28 },
  { id: "flag", kind: "celebration", month: 7, day: 23 },
  { id: "independence", kind: "celebration", month: 7, day: 24 },
  { id: "fallenDefenders", kind: "remembrance", month: 7, day: 29 },
  { id: "defenders", kind: "celebration", month: 9, day: 1 },
  // Holodomor Remembrance Day — the fourth Saturday of November.
  { id: "holodomor", kind: "remembrance", month: 10, nth: { weekday: 6, n: 4 } },
  { id: "dignity", kind: "celebration", month: 10, day: 21 },
  { id: "armedForces", kind: "celebration", month: 11, day: 6 },
];

/** What kind of day each one is — derived from the table, never re-typed. */
export const observanceKind = Object.fromEntries(
  DAYS.map((d) => [d.id, d.kind]),
) as Record<ObservanceId, ObservanceKind>;

/**
 * The nth given weekday of a month, as a day of the month. `weekday` is 0 for
 * Sunday, matching `Date`. Two observances move with the calendar rather than
 * sitting on a fixed date, so this is what places them.
 */
export function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  // Day-of-week of the 1st. UTC so the answer can't shift by one.
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const first = 1 + ((weekday - firstDow + 7) % 7);
  return first + (n - 1) * 7;
}

/** Which observance today is, or null on the other 350 days. */
export function observance(now: Date = new Date()): ObservanceId | null {
  const month = now.getMonth();
  const day = now.getDate();
  const hit = DAYS.find(
    (d) =>
      d.month === month &&
      day === (d.day ?? nthWeekday(now.getFullYear(), d.month, d.nth!.weekday, d.nth!.n)),
  );
  return hit?.id ?? null;
}
