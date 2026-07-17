import Link from "next/link";
import { displayDate, type Entry } from "@/lib/vault";
import type { ListProps } from "@/lib/section-types";

/**
 * Default "posts" list: rows grouped by month ("July 2026", …). Months with
 * no posts simply never appear — groups are built from existing entries only.
 * Undated posts collect under "Earlier" at the bottom.
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

  const groups = groupByMonth(entries);

  return (
    <div className="mt-6">
      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="mt-8 mb-1 text-sm font-medium text-[var(--text-tertiary)]">
            {group.label}
          </h2>
          <ul className="flex flex-col">
            {group.items.map((entry) => (
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
                      {displayDate(entry.date)}
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
function groupByMonth(entries: Entry[]): { label: string; items: Entry[] }[] {
  const groups: { label: string; items: Entry[] }[] = [];
  for (const entry of entries) {
    const label = entry.date ? monthLabel(entry.date) : "Earlier";
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(entry);
    else groups.push({ label, items: [entry] });
  }
  return groups;
}

/** "2026-07-16" → "July 2026" (UTC-safe). */
function monthLabel(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return "Earlier";
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}
