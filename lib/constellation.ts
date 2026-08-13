/**
 * The note constellation: the last six months of writing, a bar per week
 * (components/Constellation.tsx).
 *
 * BY WEEK, NOT BY DAY. The day grid — GitHub's shape — was built first and
 * thrown away after looking at the real vault through it: twenty-five notes
 * landing on five days, two of which held twenty-one of them, because a batch
 * of shelf notes was typed up in one sitting. 170 empty squares around five
 * specks says "abandoned", which is the opposite of true. Bucketing by week
 * absorbs the lumpiness of when things get typed up and leaves the shape of
 * when they were worked on. It costs the day-level grain, which a vault this
 * young doesn't have anyway.
 *
 * Pure and dateless — `today` is passed in rather than read — so the grid can
 * be asserted in `npm test`. Calendar code is the classic thing that looks
 * right in the month you wrote it and is off by one in another timezone or
 * across a year boundary, and this runs at BUILD time, where nobody watches.
 *
 * All arithmetic is in UTC. Frontmatter dates are bare `YYYY-MM-DD` with no
 * zone, and parsing those through the local timezone is what shifts a note
 * into the previous day for anyone west of Greenwich.
 */

/** Columns in the sidebar strip — a week each. Six months, near enough. */
export const WEEKS = 25;
/**
 * The shortest a bar with anything in it can be, as a fraction of full height.
 * A quiet week has to be visibly different from an empty one, and against a
 * fourteen-note week a single note would otherwise round to nothing.
 */
export const MIN_FILL = 0.22;

const DAY = 86_400_000;

export interface ConstellationNote {
  /** `YYYY-MM-DD` from the entry's frontmatter. */
  date: string;
  title: string;
  titleUk?: string;
  href: string;
}

export interface Week {
  /** The Monday it starts on, `YYYY-MM-DD`. */
  start: string;
  /** Notes written that week, oldest first. */
  notes: ConstellationNote[];
  /**
   * Bar height, 0 to 1, relative to the busiest week in the window. Relative
   * rather than absolute because the busiest week is the only scale the strip
   * can show — 174px of sidebar has no room for an axis.
   */
  fill: number;
}

export interface Constellation {
  weeks: Week[];
  /** First Monday and last Sunday covered, `YYYY-MM-DD`. */
  start: string;
  end: string;
  /** Notes inside the window. */
  total: number;
  /** Notes in the busiest week — what `fill` is measured against. */
  max: number;
}

/** `YYYY-MM-DD` for a UTC timestamp. */
export function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Midnight UTC for a `YYYY-MM-DD`, or NaN if it isn't one. */
export function parseDay(date: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Midnight UTC on the Monday of that day's week.
 *
 * Monday, not Sunday: the site is written from Ontario and translated into
 * Ukrainian, and both read a week as starting on Monday. It decides which
 * column a Sunday note falls in, which is a whole bar's worth at this size.
 */
export function weekStart(ms: number): number {
  const weekday = new Date(ms).getUTCDay(); // 0 = Sunday
  return ms - ((weekday + 6) % 7) * DAY;
}

/** Bar height for a count, against the busiest week. */
export function fillFor(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return MIN_FILL + (1 - MIN_FILL) * (count / max);
}

/**
 * Bucket the notes into `weeks` weekly columns ending with the week containing
 * `today`. Notes outside the window, and notes with an unparseable date, are
 * dropped: the strip is a view of recent work, not an index, and a note it
 * can't place is better missing than placed wrongly.
 */
export function buildConstellation(
  notes: ConstellationNote[],
  today: string,
  weeks: number = WEEKS
): Constellation {
  const thisMonday = weekStart(parseDay(today));
  const firstMonday = thisMonday - (weeks - 1) * 7 * DAY;
  const lastDay = thisMonday + 6 * DAY;

  const buckets: ConstellationNote[][] = Array.from({ length: weeks }, () => []);
  for (const note of notes) {
    const ms = parseDay(note.date);
    if (Number.isNaN(ms) || ms < firstMonday || ms > lastDay) continue;
    const column = Math.floor((weekStart(ms) - firstMonday) / (7 * DAY));
    buckets[column].push(note);
  }

  let total = 0;
  let max = 0;
  for (const bucket of buckets) {
    // Oldest first, so "the week's note" is where the week started.
    bucket.sort((a, b) => a.date.localeCompare(b.date));
    total += bucket.length;
    if (bucket.length > max) max = bucket.length;
  }

  return {
    weeks: buckets.map((bucket, i) => ({
      start: dayKey(firstMonday + i * 7 * DAY),
      notes: bucket,
      fill: fillFor(bucket.length, max),
    })),
    start: dayKey(firstMonday),
    end: dayKey(lastDay),
    total,
    max,
  };
}
