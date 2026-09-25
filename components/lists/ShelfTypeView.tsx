import Link from "next/link";
import ShelfCard from "@/components/lists/ShelfCard";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";
import QuotesView from "@/components/lists/QuotesView";
import CreatorsView from "@/components/lists/CreatorsView";
import ChipRowScroll from "@/components/ChipRowScroll";
import Creator from "@/components/Creator";
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
import {
  CREATORS_SLUG,
  type ShelfCreatorGroup,
} from "@/lib/shelf-creators";

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
  creators,
  showCreators = false,
  activeCreator,
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
  /**
   * Games only (#139). Every studio on the medium — passed whenever the chip
   * should exist, which is what its presence means; the page above decides,
   * not this component.
   */
  creators?: ShelfCreatorGroup[];
  /** True on /…/games/studios: the index of studios instead of any shelf. */
  showCreators?: boolean;
  /** Set on /…/games/<studio>: that studio's block, above its own games. */
  activeCreator?: ShelfCreatorGroup;
}) {
  const categories = groupCategories(group);
  const items = activeCreator
    ? activeCreator.items
    : activeCategory
      ? itemsInCategory(group, activeCategory)
      : group.items;
  const base = `/${sectionSlug}/type/${group.slug}`;
  /* Films, shows and games lead with the ranked list; books and videos keep the
     grid and the plain "All" chip. Only the UNFILTERED view changes — a
     category is a set to look at, so it stays covers (DECISIONS #113). */
  const topList =
    hasTopList(group.medium) &&
    !activeCategory &&
    !showQuotes &&
    !showCreators &&
    !activeCreator;
  const hasQuotes = Boolean(quotes && quotes.length > 0);
  const quoteCount = quotes?.reduce((n, b) => n + b.quotes.length, 0) ?? 0;
  const hasCreators = Boolean(creators && creators.length > 0);
  /* Two chip rows, one at a time (#140). Inside the studios the row lists
     STUDIOS — the row is the selection you are actually making there, and
     leaving the categories up while none of them can be chosen made the row
     furniture. The door between the two modes is the second chip, and it is
     the one chip in the row that names where it GOES rather than where you
     are: `Studios` on the way in, `Categories` on the way back. */
  const studioMode = showCreators || Boolean(activeCreator);

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
      /* `data-active` is what ChipRowScroll looks for — the styling below
         says the same thing in class names, but a marker the DOM can be
         queried by survives any change to how the active chip is painted. */
      data-active={isActive ? "" : undefined}
      className={`filter-chip press rounded-full border px-3 py-1 text-sm ${extra} ${
        isActive
          ? "border-[var(--text)] bg-[var(--text)] font-medium text-[var(--bg)]"
          : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)] hover:text-[var(--text)]"
      }`}
    >
      {label}
    </Link>
  );

  /* Built as a LIST rather than inline, because the row has to know how many
     chips it holds: two rows scrolling sideways means the top row takes
     `ceil(n / 2)` of them, and only the thing rendering them can count them
     (#143). Splitting here rather than in CSS is also what lets each row pack
     tight — see the markup below (#144). */
  const chips: React.ReactNode[] = [];
  if (studioMode) {
    /* Studio mode mirrors category mode chip for chip: the ranked view
       first, then the door out, then the values. Pressing `Studios` in the
       other mode lands you here with `Top` lit — the studios' own ranking —
       and not on a chip that names where you came from (#143). */
    chips.push(
      chip(
        <T {...ui.filterTop} />,
        `${base}/${CREATORS_SLUG}`,
        showCreators
      )
    );
    chips.push(
      chip(<T {...ui.categoriesFilter} />, base, false, "chip-quotes")
    );
    for (const c of creators ?? [])
      chips.push(
        chip(
          <T en={c.creator.name} uk={c.creator.nameUk} />,
          `${base}/${c.slug}`,
          c.slug === activeCreator?.slug
        )
      );
  } else if (categories.length > 0 || hasQuotes || hasCreators) {
    chips.push(
      chip(
        <T {...(hasTopList(group.medium) ? ui.filterTop : ui.filterAll)} />,
        base,
        !activeCategory && !showQuotes
      )
    );
    /* Straight after Top, in the same slot and the same set-apart voice as
       Quotes: neither is a category, and both open a different kind of
       page. */
    if (hasCreators)
      chips.push(
        chip(
          <T {...ui.studiosCategory} />,
          `${base}/${CREATORS_SLUG}`,
          false,
          "chip-quotes"
        )
      );
    if (hasQuotes)
      chips.push(
        chip(<T {...ui.quotesCategory} />, `${base}/quotes`, showQuotes, "chip-quotes")
      );
    for (const c of categories)
      chips.push(
        chip(
          <T {...categoryLabel(c)} />,
          `${base}/${categorySlug(c)}`,
          c === activeCategory
        )
      );
  }

  const chipSplit = Math.ceil(chips.length / 2);

  return (
    <div>
      <header>
        <h1 className="page-title text-2xl font-semibold tracking-tight text-[var(--text)]">
          {/* The index is a list of STUDIOS, so it counts studios and says so
              (#143). Every other view here is a shelf of the medium, however
              it is filtered, and keeps the medium's name. */}
          <T {...(showCreators ? ui.studiosCategory : group.label)} />
          {/* Inherits the heading's size, weight and tracking — only the
              colour separates it from the title. */}
          <span className="ml-2.5 text-[var(--text-tertiary)]">
            {showQuotes
              ? quoteCount
              : showCreators
                ? (creators?.length ?? 0)
                : items.length}
          </span>
        </h1>
      </header>

      {chips.length > 0 && (
        /* TWO ROWS THAT SCROLL SIDEWAYS (#141, #143, #144). The halves are
           split HERE and each row packs itself, because a grid aligns its
           columns: with `max-content` columns every column was as wide as the
           wider of its two chips, so `Top` above `GSC Game World` left a gap
           the width of the difference, over and over down the row. Two
           independent flex rows have nothing to line up with. */
        <div className="filter-chips mt-6">
          <div className="filter-chip-rows">
            <div className="filter-chip-row">{chips.slice(0, chipSplit)}</div>
            {chips.length > chipSplit && (
              <div className="filter-chip-row">{chips.slice(chipSplit)}</div>
            )}
          </div>
          {/* Brings the lit chip into view on arrival — you pressed it to get
              here, so finding the row scrolled past it is the one thing this
              can get wrong. */}
          <ChipRowScroll />
        </div>
      )}

      {showQuotes ? (
        <QuotesView sectionSlug={sectionSlug} books={quotes ?? []} />
      ) : showCreators ? (
        <CreatorsView
          sectionSlug={sectionSlug}
          mediumSlug={group.slug}
          creators={creators ?? []}
        />
      ) : topList ? (
        <>
          <ShelfTopList items={items} sectionSlug={sectionSlug} />
          {empty}
        </>
      ) : (
        <>
          {/* Whose shelf this is, in the block the note pages already use —
              the reader arrives here from one of them, and the same portrait
              and sentence is what says they landed on the right studio. It
              carries no link: this IS the page it would lead to. */}
          {activeCreator && <Creator creator={activeCreator.creator} />}

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
