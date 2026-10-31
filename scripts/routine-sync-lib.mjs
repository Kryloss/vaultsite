/**
 * Turning what Calendar and Reminders hold into what the routine stores. Pure,
 * so `npm test` covers it without a Mac (docs/ROUTINE.md).
 *
 * Calendar's scripting interface returns a repeating class once, as its series,
 * so the dates are worked out here. TMU's own series overlap and start on days
 * outside their pattern, which is why a day only counts if the rule names it.
 */

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const DAY_MS = 86_400_000;

function pad(value) {
  return String(value).padStart(2, "0");
}

/** The local calendar date of a Date, as YYYY-MM-DD. */
export function isoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local noon, so counting days never crosses a clock change. */
function dayOf(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function minutes(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function parseUntil(value) {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(value ?? "");
  if (!match) return null;
  const [, year, month, day, hour = "23", minute = "59", second = "59"] = match;
  return new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second));
}

/** A weekly rule, or null for anything else: a skipped event is safer than a wrong one. */
export function parseRule(rule) {
  const parts = Object.fromEntries(
    String(rule ?? "")
      .split(";")
      .map((part) => part.split("="))
  );
  if (parts.FREQ !== "WEEKLY" || parts.BYSETPOS || parts.COUNT) return null;
  const days = (parts.BYDAY ?? "").split(",").filter((day) => WEEKDAYS.includes(day));
  if (!days.length) return null;
  return { days, interval: Number(parts.INTERVAL ?? 1) || 1, until: parseUntil(parts.UNTIL) };
}

/** The dates in `from`..`to` this event falls on. */
export function occurrences(event, from, to) {
  const start = new Date(event.start);
  const first = isoDate(start);
  if (!event.rule) return first >= from && first <= to ? [first] : [];

  const rule = parseRule(event.rule);
  if (!rule) return [];

  const excluded = new Set(event.excluded ?? []);
  const seriesWeek = Math.floor((dayOf(first).getTime() - start.getDay() * DAY_MS) / (7 * DAY_MS));
  const dates = [];

  for (let day = dayOf(from > first ? from : first); isoDate(day) <= to; day = new Date(day.getTime() + DAY_MS)) {
    const iso = isoDate(day);
    if (!rule.days.includes(WEEKDAYS[day.getDay()]) || excluded.has(iso)) continue;
    const week = Math.floor((day.getTime() - day.getDay() * DAY_MS) / (7 * DAY_MS));
    if ((week - seriesWeek) % rule.interval !== 0) continue;
    const at = new Date(day);
    at.setHours(start.getHours(), start.getMinutes(), 0, 0);
    if (rule.until && at > rule.until) continue;
    dates.push(iso);
  }
  return dates;
}

/** "CYS119 - 031 - LEC" → "CYS119 LEC". Anything else keeps its own title. */
export function cleanTitle(title) {
  const match = /^([A-Z]{2,4}\s?\d{3})\s*-\s*\w+\s*-\s*(LEC|LAB|TUT|SEM)$/.exec(title.trim());
  return match ? `${match[1].replace(/\s/g, "")} ${match[2]}` : title.trim();
}

/** The dated classes the Uni vault says won't happen: `date<TAB>match<TAB>hide<TAB>source`. */
export function parseOverrides(text) {
  return text
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("\t"))
    .filter(([, , action]) => action === "hide")
    .map(([date, match]) => ({ date, match: match.toLowerCase() }));
}

/**
 * Every timed event from `from` to `to`, one block per date. All-day events are
 * notices rather than time taken, and an event running past midnight stops there.
 * Series overlap, so one class can arrive twice; the newest series wins.
 */
export function blocksFrom(events, overrides, from, to) {
  const byKey = new Map();
  const oldestFirst = [...events].sort((a, b) => a.start.localeCompare(b.start));

  for (const event of oldestFirst) {
    if (event.allDay || !event.title?.trim()) continue;
    const start = new Date(event.start);
    const end = new Date(event.end);
    const length = Math.round((end.getTime() - start.getTime()) / 60_000);
    if (length <= 0 || length >= 1440) continue;

    const title = cleanTitle(event.title);
    const lower = title.toLowerCase();
    // TMU classes before noon start ten minutes after the hour.
    const start_min = minutes(start) + (event.tmu && minutes(start) < 720 ? 10 : 0);
    const end_min = Math.min(minutes(start) + length, 1440);
    if (end_min <= start_min) continue;

    for (const on_date of occurrences(event, from, to)) {
      if (overrides.some((hide) => hide.date === on_date && lower.startsWith(hide.match))) continue;
      const key = `${title}|${on_date}|${start_min}`;
      byKey.set(key, { key, title: title.slice(0, 200), on_date, start_min, end_min, location: (event.location ?? "").trim().slice(0, 200) });
    }
  }
  return [...byKey.values()];
}

/** Open Reminders. A due time of midnight is how Reminders stores "no time". */
export function tasksFrom(reminders) {
  const seen = new Set();
  const tasks = [];
  for (const reminder of reminders) {
    const title = reminder.title?.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
    if (!title || !reminder.id || seen.has(reminder.id)) continue;
    seen.add(reminder.id);

    const due = reminder.due ? new Date(reminder.due) : null;
    const at = due ? minutes(due) : 0;
    tasks.push({
      key: reminder.id,
      title: title.slice(0, 200),
      due_on: due ? isoDate(due) : null,
      due_min: at ? at : null,
    });
  }
  return tasks;
}
