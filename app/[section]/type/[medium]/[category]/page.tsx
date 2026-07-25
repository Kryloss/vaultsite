import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSections, getSectionBySlug, getEntries } from "@/lib/vault";
import {
  categoryFromSlug,
  categorySlug,
  groupCategories,
  isShelfSection,
  shelfGroupBySlug,
  shelfGroups,
} from "@/lib/shelf";
import ShelfTypeView from "@/components/lists/ShelfTypeView";
import T from "@/components/T";

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
        .flatMap((group) =>
          groupCategories(group).map((category) => ({
            section: section.slug,
            medium: group.slug,
            category: categorySlug(category),
          }))
        )
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
  };
}

export default async function ShelfCategoryPage({ params }: Props) {
  const { section: sectionSlug, medium, category } = await params;
  const section = getSectionBySlug(sectionSlug);
  if (!section || !isShelfSection(section)) notFound();

  const group = shelfGroupBySlug(getEntries(section), medium);
  if (!group) notFound();

  const name = categoryFromSlug(group, category);
  if (!name) notFound();

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
      />
    </div>
  );
}
