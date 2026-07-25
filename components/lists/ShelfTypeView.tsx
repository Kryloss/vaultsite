import Link from "next/link";
import ShelfCard from "@/components/lists/ShelfCard";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";
import {
  categoryLabel,
  categorySlug,
  groupCategories,
  itemsInCategory,
  type ShelfGroup,
} from "@/lib/shelf";

/**
 * A shelf medium page: heading, category chips, grid. Shared by
 * /<section>/type/<medium> and /<section>/type/<medium>/<category>.
 *
 * Server component on purpose. Filtering used to be client state driven by a
 * `?category=` query param, but reading the URL during an App Router
 * transition is unreliable — the effect can fire before the new URL is
 * committed, so an incoming link landed on the page unfiltered. Each category
 * is now its own statically-rendered page: the chips are plain links, the
 * filtering happens at build time, and there is no timing to get wrong.
 */
export default function ShelfTypeView({
  sectionSlug,
  group,
  activeCategory,
}: {
  sectionSlug: string;
  group: ShelfGroup;
  /** undefined = "All" */
  activeCategory?: string;
}) {
  const categories = groupCategories(group);
  const items = activeCategory
    ? itemsInCategory(group, activeCategory)
    : group.items;
  const base = `/${sectionSlug}/type/${group.slug}`;

  const chip = (label: React.ReactNode, href: string, isActive: boolean) => (
    <Link
      key={href}
      href={href}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        isActive
          ? "border-[var(--text)] bg-[var(--text)] font-medium text-[var(--bg)]"
          : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)] hover:text-[var(--text)]"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div>
      <header className="mt-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          <T {...group.label} />
          {/* Inherits the heading's size, weight and tracking — only the
              colour separates it from the title. */}
          <span className="ml-2.5 text-[var(--text-tertiary)]">
            {items.length}
          </span>
        </h1>
      </header>

      {categories.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {chip(<T {...ui.filterAll} />, base, !activeCategory)}
          {categories.map((c) =>
            chip(
              <T {...categoryLabel(c)} />,
              `${base}/${categorySlug(c)}`,
              c === activeCategory
            )
          )}
        </div>
      )}

      {/* Every card here is the same shape, so a plain grid is safe. */}
      <ul
        className={`mt-8 grid gap-x-5 gap-y-10 ${
          group.items.some((i) => i.isVideo)
            ? "grid-cols-1 sm:grid-cols-2"
            : "grid-cols-2 sm:grid-cols-3"
        }`}
      >
        {items.map((item) => (
          <li key={item.slug}>
            <ShelfCard item={item} sectionSlug={sectionSlug} />
          </li>
        ))}
      </ul>

      {items.length === 0 && (
        <p className="mt-10 text-sm text-[var(--text-tertiary)]">
          <T {...ui.nothingOnShelf} />
        </p>
      )}
    </div>
  );
}
