"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Stars from "@/components/Stars";
import T from "@/components/T";
import { ui, type Str } from "@/lib/ui-strings";

export interface ShelfItem {
  slug: string;
  title: string;
  titleUk?: string;
  author?: string;
  medium?: string;
  coverUrl?: string;
  /** "contain" letterboxes wide art (logos) instead of cropping to fill. */
  coverFit?: "contain";
  /** 0–5, halves allowed. */
  rating?: number;
}

/** Pretty, bilingual labels for common mediums; unknown values shown as-is. */
const MEDIUM_LABELS: Record<string, Str> = {
  book: ui.mediumBooks,
  movie: ui.mediumMovies,
  show: ui.mediumShows,
};

function mediumLabel(m: string): Str {
  const cap = m.charAt(0).toUpperCase() + m.slice(1);
  return MEDIUM_LABELS[m] ?? { en: cap, uk: cap };
}

/**
 * Client half of the shelf: medium filter chips (Books / Movies / Shows —
 * only shown when at least one entry declares a `medium:`) + the cover grid.
 */
export default function ShelfGridClient({
  sectionSlug,
  items,
}: {
  sectionSlug: string;
  items: ShelfItem[];
}) {
  const [active, setActive] = useState<string | null>(null);

  const mediums = useMemo(() => {
    const seen: string[] = [];
    for (const item of items) {
      if (item.medium && !seen.includes(item.medium)) seen.push(item.medium);
    }
    return seen;
  }, [items]);

  const filtered = active ? items.filter((i) => i.medium === active) : items;

  const chip = (key: string, label: Str, value: string | null) => (
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
      <T {...label} />
    </button>
  );

  return (
    <div>
      {mediums.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {chip("__all", ui.filterAll, null)}
          {mediums.map((m) => chip(m, mediumLabel(m), m))}
        </div>
      )}

      <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3">
        {filtered.map((item) => (
          <li key={item.slug}>
            <Link href={`/${sectionSlug}/${item.slug}`} className="group block">
              <div className="aspect-[2/3] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] shadow-sm transition-shadow duration-300 group-hover:shadow-md">
                {item.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.coverUrl}
                    alt={item.title}
                    className={
                      item.coverFit === "contain"
                        ? "h-full w-full object-contain p-6"
                        : "h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    }
                    loading="lazy"
                  />
                ) : (
                  /* Spine-style fallback cover */
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-3 text-center">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                      {item.author ?? "—"}
                    </span>
                    <span className="text-sm font-semibold leading-snug text-[var(--text-secondary)]">
                      {item.title}
                    </span>
                    <span className="h-px w-8 bg-[var(--border)]" />
                  </div>
                )}
              </div>
              <span className="mt-2.5 block font-medium leading-snug text-[var(--text)]">
                <T en={item.title} uk={item.titleUk} />
              </span>
              {item.author && (
                <span className="mt-0.5 block text-sm leading-snug text-[var(--text-secondary)]">
                  {item.author}
                </span>
              )}
              {typeof item.rating === "number" && (
                <Stars rating={item.rating} className="mt-1.5" />
              )}
            </Link>
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <p className="mt-10 text-sm text-[var(--text-tertiary)]">
          <T {...ui.nothingOnShelf} />
        </p>
      )}
    </div>
  );
}
