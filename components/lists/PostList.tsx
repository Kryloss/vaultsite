import Link from "next/link";
import type { Entry } from "@/lib/vault";
import type { ListProps } from "@/lib/section-types";

/**
 * Default "posts" list: entries grouped by year —
 *
 *   2026            ← large, primary text color
 *     Post title ..................... 16.07
 *
 * Only years that actually contain posts render. Undated posts collect
 * under "Earlier" at the bottom. Row dates are DD.MM (the year lives in
 * the group heading). This DD.MM format is intentionally posts-only —
 * other section types show full dates.
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

  const years = groupByYear(entries);

  return (
    <div className="mt-4">
      {years.map((year) => (
        <section key={year.label}>
          <h2 className="mt-10 text-xl font-semibold tracking-tight tabular-nums text-[var(--text)]">
            {year.label}
          </h2>
          <ul className="mt-2 flex flex-col">
            {year.items.map((entry) => (
              <li key={entry.slug}>
                <Link
                  href={`/${section.slug}/${entry.slug}`}
                  className="group -mx-3 flex items-baseline justify-between gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--bg-hover)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-[var(--text)] group-hover:text-[var(--accent)]">
                      {entry.title}
                      {entry.draft && (
                        <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-500">
                          Draft
                        </span>
                      )}
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
        </section>
      ))}
    </div>
  );
}

/** Entries arrive sorted newest-first, so consecutive grouping is enough. */
function groupByYear(entries: Entry[]): { label: string; items: Entry[] }[] {
  const years: { label: string; items: Entry[] }[] = [];
  for (const entry of entries) {
    const label = entry.date ? entry.date.slice(0, 4) : "Earlier";
    const last = years[years.length - 1];
    if (last && last.label === label) last.items.push(entry);
    else years.push({ label, items: [entry] });
  }
  return years;
}

/** "2026-07-16" → "16.07" */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  if (!m || !d) return iso;
  return `${d}.${m}`;
}
