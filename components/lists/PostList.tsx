import Link from "next/link";
import { displayDate } from "@/lib/vault";
import type { ListProps } from "@/lib/section-types";

/**
 * Default "posts" list: brianlovin-style rows — title left, date right,
 * hairline dividers, subtle hover. Each row links to /<section>/<slug>.
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

  return (
    <ul className="mt-8 flex flex-col">
      {entries.map((entry) => (
        <li key={entry.slug} className="border-b border-[var(--border)] last:border-b-0">
          <Link
            href={`/${section.slug}/${entry.slug}`}
            className="group -mx-3 flex items-baseline justify-between gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-[var(--bg-hover)]"
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
  );
}
