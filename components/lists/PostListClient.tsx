"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";

export interface PostRow {
  slug: string;
  title: string;
  titleUk?: string;
  description?: string;
  date?: string;
  draft: boolean;
  category?: string;
}

/**
 * Client half of the posts list: category filter chips (shown only when at
 * least one post has a `category:`) + entries grouped by year. Row dates are
 * DD.MM — the year lives in the group heading.
 */
export default function PostListClient({
  sectionSlug,
  rows,
}: {
  sectionSlug: string;
  rows: PostRow[];
}) {
  const [active, setActive] = useState<string | null>(null);

  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const row of rows) {
      if (row.category && !seen.includes(row.category)) seen.push(row.category);
    }
    return seen;
  }, [rows]);

  const filtered = active ? rows.filter((r) => r.category === active) : rows;
  const years = groupByYear(filtered);

  const chip = (key: string, label: ReactNode, value: string | null) => (
    <button
      key={key}
      type="button"
      onClick={() => setActive(value)}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        active === value
          ? "border-[var(--text)] bg-[var(--text)] font-medium text-[var(--bg)]"
          : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)] hover:text-[var(--text)]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-4">
      {categories.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {chip("__all", <T {...ui.filterAll} />, null)}
          {categories.map((c) => chip(c, c, c))}
        </div>
      )}

      {years.map((year) => (
        <section key={year.label}>
          <h2 className="mt-10 text-xl font-semibold tracking-tight tabular-nums text-[var(--text)]">
            {year.label}
          </h2>
          <ul className="mt-2 flex flex-col">
            {year.items.map((row) => (
              <li key={row.slug}>
                <Link
                  href={`/${sectionSlug}/${row.slug}`}
                  className="group -mx-3 flex items-baseline justify-between gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--bg-hover)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-[var(--text)]">
                      <T en={row.title} uk={row.titleUk} />
                      {row.draft && (
                        <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-500">
                          Draft
                        </span>
                      )}
                    </span>
                    {row.description && (
                      <span className="mt-0.5 block truncate text-sm text-[var(--text-secondary)]">
                        {row.description}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2.5">
                    {row.category && (
                      <span className="hidden text-xs text-[var(--text-tertiary)] sm:inline">
                        {row.category}
                      </span>
                    )}
                    {row.date && (
                      <time
                        dateTime={row.date}
                        className="text-sm tabular-nums text-[var(--text-tertiary)]"
                      >
                        {shortDate(row.date)}
                      </time>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {filtered.length === 0 && (
        <p className="mt-10 text-sm text-[var(--text-tertiary)]">
          <T {...ui.nothingInCategory} />
        </p>
      )}
    </div>
  );
}

function groupByYear(rows: PostRow[]): { label: string; items: PostRow[] }[] {
  const years: { label: string; items: PostRow[] }[] = [];
  for (const row of rows) {
    const label = row.date ? row.date.slice(0, 4) : "Earlier";
    const last = years[years.length - 1];
    if (last && last.label === label) last.items.push(row);
    else years.push({ label, items: [row] });
  }
  return years;
}

/** "2026-07-16" → "16.07" */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  if (!m || !d) return iso;
  return `${d}.${m}`;
}
