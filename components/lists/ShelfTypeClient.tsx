"use client";

import { useMemo, useState } from "react";
import ShelfCard from "@/components/lists/ShelfCard";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";
import type { ShelfItem } from "@/lib/shelf";

/**
 * Client half of a shelf medium page (/<section>/type/<medium>): category
 * filter chips + the grid.
 *
 * Categories live only here and on the entry page — the section page stays a
 * plain set of medium rows. An item can carry several categories and shows up
 * under each of them.
 *
 * Category names are raw strings from frontmatter, shown as-is in both
 * languages (same as the posts' category chips).
 */
export default function ShelfTypeClient({
  sectionSlug,
  items,
  categories,
}: {
  sectionSlug: string;
  items: ShelfItem[];
  categories: string[];
}) {
  const [active, setActive] = useState<string | null>(null);

  const filtered = useMemo(
    () => (active ? items.filter((i) => i.categories.includes(active)) : items),
    [items, active]
  );

  const chip = (key: string, label: string, value: string | null) => (
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
      {value === null ? <T {...ui.filterAll} /> : label}
    </button>
  );

  const wide = items.some((i) => i.isVideo);

  return (
    <div>
      {categories.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {chip("__all", "", null)}
          {categories.map((c) => chip(c, c, c))}
        </div>
      )}

      {/* Every card here is the same shape, so a plain grid is safe. */}
      <ul
        className={`mt-8 grid gap-x-5 gap-y-10 ${
          wide ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3"
        }`}
      >
        {filtered.map((item) => (
          <li key={item.slug}>
            <ShelfCard item={item} sectionSlug={sectionSlug} />
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
