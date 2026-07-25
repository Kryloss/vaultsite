/**
 * Day counter for Ukraine's resistance, shown in the sidebar.
 *
 * Start date: 20 February 2014 — the date Ukraine counts russian armed
 * aggression from (the assault on Crimea), and the start date used on the
 * state's "For the Defence of Ukraine" award. That day is day 1.
 *
 * Computed in UTC so the number never shifts by one across timezones or DST.
 * The site is fully static, so the build-time value is passed into the sidebar
 * as a prop and then re-checked in the browser — see components/ResistanceDay.
 */
export const RESISTANCE_START = Date.UTC(2014, 1, 20); // months are 0-based

const DAY_MS = 86_400_000;

/** Day number of the resistance, 1-based. 20 Feb 2014 → 1. */
export function resistanceDay(now: Date = new Date()): number {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(1, Math.floor((today - RESISTANCE_START) / DAY_MS) + 1);
}
