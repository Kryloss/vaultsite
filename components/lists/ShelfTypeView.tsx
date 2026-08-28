import Link from "next/link";
import ShelfCard from "@/components/lists/ShelfCard";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";
import QuotesView from "@/components/lists/QuotesView";
import ShelfTopList from "@/components/lists/ShelfTopList";
import {
  categoryLabel,
  categorySlug,
  groupCategories,
  hasTopList,
  itemsInCategory,
  type ShelfGroup,
} from "@/lib/shelf";
import type { BookQuotes } from "@/lib/quotes";

/**
 * A shelf medium page: heading, category chips, and a grid of full-size
 * covers. Shared by /<section>/type/<medium> and
 * /<section>/type/<medium>/<category>.
 *
 * Books are NOT a special case here, deliberately. The standing spines live
 * on the section page's books row (components/lists/BookSpines.tsx); this is
 * the page you reach once you have chosen books, and cover art is what a book
 * is recognised by. It shipped the other way round once — see DECISIONS #110
 * before swapping it back.
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
  quotes,
  showQuotes = false,
}: {
  sectionSlug: string;
  group: ShelfGroup;
  /** undefined = "All" */
  activeCategory?: string;
  /**
   * Books only. A synthetic category — it comes from the blockquotes inside
   * notes rather than from `categories:` frontmatter — so it gets its own chip
   * and its own view instead of joining the grid.
   */
  quotes?: BookQuotes[];
  /** True on /…/books/quotes: render the quotes instead of the cover grid. */
  showQuotes?: boolean;
}) {
  const categories = groupCategories(group);
  const items = activeCategory
    ? itemsInCategory(group, activeCategory)
    : group.items;
  const base = `/${sectionSlug}/type/${group.slug}`;
  /* Films and shows lead with the ranked list; books and videos keep the
     grid and the plain "All" chip. Only the UNFILTERED view changes — a
     category is a set to look at, so it stays covers (DECISIONS #113). */
  const topList = hasTopList(group.medium) && !activeCategory && !showQuotes;
  const hasQuotes = Boolean(quotes && quotes.length > 0);
  const quoteCount = quotes?.reduce((n, b) => n + b.quotes.length, 0) ?? 0;

  /* Shared by both views: a filtered page can come back empty whichever
     grammar it uses, and an empty shelf still needs to say so. */
  const empty = items.length === 0 && (
    <p className="mt-10 text-sm text-[var(--text-tertiary)]">
      <T {...ui.nothingOnShelf} />
    </p>
  );

  const chip = (
    label: React.ReactNode,
    href: string,
    isActive: boolean,
    extra = ""
  ) => (
    <Link
      key={href}
      href={href}
      className={`press rounded-full border px-3 py-1 text-sm ${extra} ${
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
      <header>
        <h1 className="page-title text-2xl font-semibold tracking-tight text-[var(--text)]">
          <T {...group.label} />
          {/* Inherits the heading's size, weight and tracking — only the
              colour separates it from the title. */}
          <span className="ml-2.5 text-[var(--text-tertiary)]">
            {showQuotes ? quoteCount : items.length}
          </span>
        </h1>
      </header>

      {(categories.length > 0 || hasQuotes) && (
        <div className="mt-6 flex flex-wrap gap-2">
          {chip(
            <T {...(hasTopList(group.medium) ? ui.filterTop : ui.filterAll)} />,
            base,
            !activeCategory && !showQuotes
          )}
          {/* Straight after All, and only when there's something behind it.
              Set apart typographically rather than by ornament, because it
              isn't a category — it opens a different kind of page. */}
          {hasQuotes &&
            chip(
              <T {...ui.quotesCategory} />,
              `${base}/quotes`,
              showQuotes,
              "chip-quotes"
            )}
          {categories.map((c) =>
            chip(
              <T {...categoryLabel(c)} />,
              `${base}/${categorySlug(c)}`,
              c === activeCategory
            )
          )}
        </div>
      )}

      {showQuotes ? (
        <QuotesView sectionSlug={sectionSlug} books={quotes ?? []} />
      ) : topList ? (
        <>
          <ShelfTopList items={items} sectionSlug={sectionSlug} />
          {empty}
        </>
      ) : (
        <>
          {/* Every card here is the same shape, so a plain grid is safe. */}
          <ul
            className={`stagger mt-8 grid gap-x-5 gap-y-10 ${
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

          {empty}
        </>
      )}
    </div>
  );
}
