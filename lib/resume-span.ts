/**
 * Résumé periods as spans of months — the bars of the Now page's "at a glance"
 * chart (page idea `nowTimeline`, lib/site-config.ts).
 *
 * The periods are free text the owner writes in Obsidian ("Oct 2025 —
 * present", "2022 — 2026", "From Sept 2026", "In progress"), so this reads the
 * shapes that are there and returns null for anything else — a row it can't
 * place is left off the chart, never guessed onto it.
 *
 * A month is counted as `year * 12 + monthIndex`, so a span's length is a
 * subtraction.
 */

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

export interface Span {
  /** First month, as year * 12 + month. */
  start: number;
  /** Last month, or null while it is still going ("present", "From …"). */
  end: number | null;
}

/**
 * "Oct 2025" / "October 2025" / "2025". A bare year starts in January; as an
 * END it is read as mid-year, because "2022 — 2026" for a school means June,
 * and running it to December would overlap whatever started that autumn.
 */
function point(text: string, as: "start" | "end"): number | null {
  const t = text.trim().toLowerCase().replace(/\.$/, "");
  const my = /^([a-z]+)\.?\s+(\d{4})$/.exec(t);
  if (my) {
    const key = my[1].slice(0, my[1].startsWith("sept") ? 4 : 3);
    const month = MONTHS[key];
    return month === undefined ? null : Number(my[2]) * 12 + month;
  }
  const y = /^(\d{4})$/.exec(t);
  if (y) return Number(y[1]) * 12 + (as === "start" ? 0 : 5);
  return null;
}

export function parseSpan(period: string | undefined): Span | null {
  if (!period) return null;
  const text = period.trim();

  const from = /^(?:from|since)\s+(.+)$/i.exec(text);
  if (from) {
    const start = point(from[1], "start");
    return start === null ? null : { start, end: null };
  }

  const parts = text.split(/\s*[—–-]\s*/);
  if (parts.length !== 2) return null;
  const start = point(parts[0], "start");
  if (start === null) return null;
  if (/^(present|now|today)$/i.test(parts[1].trim())) return { start, end: null };
  const end = point(parts[1], "end");
  if (end === null || end < start) return null;
  return { start, end };
}

/** The chart's range: whole years from the earliest start to the year after `now`. */
export function chartRange(spans: Span[], now: number): { from: number; to: number } | null {
  if (spans.length === 0) return null;
  const earliest = Math.min(...spans.map((s) => s.start));
  const latest = Math.max(now, ...spans.map((s) => s.end ?? now));
  return {
    from: Math.floor(earliest / 12) * 12,
    to: (Math.floor(latest / 12) + 1) * 12,
  };
}

/** Month count for a Date, in the same units as a Span. */
export function monthOf(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}
