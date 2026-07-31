import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSections, getSectionBySlug, getEntries } from "@/lib/vault";
import { pageMeta } from "@/lib/metadata";
import {
  categoryFromSlug,
  categorySlug,
  groupCategories,
  isShelfSection,
  shelfGroupBySlug,
  shelfGroups,
} from "@/lib/shelf";
import { getBookQuotes } from "@/lib/quotes";
import ShelfTypeView from "@/components/lists/ShelfTypeView";
import T from "@/components/T";

/** URL segment for the synthetic Quotes category — see lib/quotes.ts. */
const QUOTES_SLUG = "quotes";

interface Props {
  params: Promise<{ section: string; medium: string; category: string }>;
}

export const dynamicParams = false;

/**
 * One page per category within a medium, e.g. /shelf/type/videos/tech.
 *
 * A real page rather than a `?category=` filter on the medium page: the chips
 * are then plain links, the filtering happens at build time, and a shared link
 * lands pre-filtered with no JavaScript and no flash of the unfiltered grid.
 */
export function generateStaticParams() {
  return getSections()
    .filter(isShelfSection)
    .flatMap((section) =>
      shelfGroups(getEntries(section))
        .filter((g) => g.medium !== "unsorted")
        .flatMap((group) => {
          const params = groupCategories(group).map((category) => ({
            section: section.slug,
            medium: group.slug,
            category: categorySlug(category),
          }));
          // The synthetic Quotes page, only where books actually carry quotes.
          if (
            group.medium === "book" &&
            getBookQuotes(getEntries(section)).length > 0
          ) {
            params.push({
              section: section.slug,
              medium: group.slug,
              category: QUOTES_SLUG,
            });
          }
          return params;
        })
    );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section: sectionSlug, medium, category } = await params;
  const section = getSectionBySlug(sectionSlug);
  if (!section) return {};
  const group = shelfGroupBySlug(getEntries(section), medium);
  const name = group ? categoryFromSlug(group, category) : undefined;
  if (!group || !name) return {};
  // Same title as the unfiltered medium page — the category shows as the
  // active chip on the page, and repeating it in the tab was noise.
  return {
    title: `${group.label.en} · ${section.title}`,
    description: section.description,
    ...pageMeta({ path: `/${sectionSlug}/type/${medium}/${category}` }),
  };
}

export default async function ShelfCategoryPage({ params }: Props) {
  const { section: sectionSlug, medium, category } = await params;
  const section = getSectionBySlug(sectionSlug);
  if (!section || !isShelfSection(section)) notFound();

  const entries = getEntries(section);
  const group = shelfGroupBySlug(entries, medium);
  if (!group) notFound();

  const quotes = group.medium === "book" ? getBookQuotes(entries) : undefined;
  const showQuotes = category === QUOTES_SLUG && Boolean(quotes?.length);

  // Quotes isn't a real category, so it won't resolve through the frontmatter.
  const name = showQuotes ? undefined : categoryFromSlug(group, category);
  if (!name && !showQuotes) notFound();

  return (
    <div className="mx-auto max-w-2xl px-6 py-14 lg:py-24">
      <Link
        href={`/${section.slug}`}
        className="text-sm text-[var(--text-tertiary)] transition-colors hover:text-[var(--text)]"
      >
        ← <T en={section.title} uk={section.titleUk} />
      </Link>

      <ShelfTypeView
        sectionSlug={section.slug}
        group={group}
        activeCategory={name}
        quotes={quotes}
        showQuotes={showQuotes}
      />
    </div>
  );
}
