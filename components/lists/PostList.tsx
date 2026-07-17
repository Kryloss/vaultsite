import Link from "next/link";
import type { Entry } from "@/lib/vault";
import type { ListProps } from "@/lib/section-types";

/**
 * Default "posts" list: entries grouped by year, then by month —
 *
 *   2026
 *   July
 *     Post title ..................... 16.07
 *
 * Only months/years that actually contain posts render. Undated posts
 * collect under "Earlier" at the bottom. Row dates are DD.MM (year is
 * already in the group heading).
 */
export default function PostList({ section, entries }: ListProps) {
  if (entries.length === 0) {
    return (
      <p className="mt-10 text-sm text-[var(--text-tertiary)]">
        Nothing here yet. Add a .md file next to this section&rsquo;s main.md in
        your vault and it will show up automatically.
      </p>
    );
  }

  const years = groupEntries(entries);

  return (
    <div className="mt-4">
      {years.map((year) => (
        <section key={year.label}>
          <h2 className="mt-10 text-sm font-medium tabular-nums text-[var(--text-tertiary)]">
            {year.label}
          </h2>
          {year.months.map((month) => (
            <div key={month.label}>
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-[var(--text)]">
                {month.label}
              </h3>
              <ul className="mt-1 flex flex-col">
                {month.items.map((entry) => (
                  <li key={entry.slug}>
                    <Link
                      href={`/${section.slug}/${entry.slug}`}
                      className="group -mx-3 flex items-baseline justify-between gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--bg-hover)]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-[var(--text)] group-hover:text-[var(--accent)]">
                          {entry.title}
                        </span>
                        {entry.description && (
                          <span className="mt-0.5 block truncate text-sm text-[var(--text-secondary)]">
                            {entry.description}
                          </span>
                        )}
                      </span>
                      {entry.date && (
                        <time
                          dateTime={entry.date}
                          className="shrink-0 text-sm tabular-nums text-[var(--text-tertiary)]"
                        >
                          {shortDate(entry.date)}
                        </time>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

interface MonthGroup {
  label: string;
  items: Entry[];
}
interface YearGroup {
  label: string;
  months: MonthGroup[];
}

/** Entries arrive sorted newest-first, so consecutive grouping is enough. */
function groupEntries(entries: Entry[]): YearGroup[] {
  const years: YearGroup[] = [];
  for (const entry of entries) {
    const [y, m] = entry.date ? entry.date.split("-").map(Number) : [];
    const yearLabel = y ? String(y) : "Earlier";
    const monthLabel =
      y && m
        ? new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
            month: "long",
            timeZone: "UTC",
          })
        : "";

    let year = years[years.length - 1];
    if (!year || year.label !== yearLabel) {
      year = { label: yearLabel, months: [] };
      years.push(year);
    }
    let month = year.months[year.months.length - 1];
    if (!month || month.label !== monthLabel) {
      month = { label: monthLabel, items: [] };
      year.months.push(month);
    }
    month.items.push(entry);
  }
  return years;
}

/** "2026-07-16" → "16.07" */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  if (!m || !d) return iso;
  return `${d}.${m}`;
}
