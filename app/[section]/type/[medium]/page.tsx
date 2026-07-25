import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSections, getSectionBySlug, getEntries } from "@/lib/vault";
import {
  groupCategories,
  isShelfSection,
  shelfGroupBySlug,
  shelfMediumSlugs,
} from "@/lib/shelf";
import ShelfTypeClient from "@/components/lists/ShelfTypeClient";
import T from "@/components/T";

interface Props {
  params: Promise<{ section: string; medium: string }>;
}

export const dynamicParams = false;

/**
 * One page per medium in every shelf-type section, e.g. /shelf/type/videos.
 *
 * The extra `type` segment keeps these out of the entry namespace — /shelf/videos
 * would collide with an entry whose slug happened to be "videos".
 */
export function generateStaticParams() {
  return getSections()
    .filter(isShelfSection)
    .flatMap((section) =>
      shelfMediumSlugs(getEntries(section)).map((medium) => ({
        section: section.slug,
        medium,
      }))
    );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section: sectionSlug, medium } = await params;
  const section = getSectionBySlug(sectionSlug);
  if (!section) return {};
  const group = shelfGroupBySlug(getEntries(section), medium);
  if (!group) return {};
  return {
    title: `${group.label.en} · ${section.title}`,
    description: section.description,
  };
}

export default async function ShelfMediumPage({ params }: Props) {
  const { section: sectionSlug, medium } = await params;
  const section = getSectionBySlug(sectionSlug);
  if (!section || !isShelfSection(section)) notFound();

  const group = shelfGroupBySlug(getEntries(section), medium);
  if (!group) notFound();

  return (
    <div className="mx-auto max-w-2xl px-6 py-14 lg:py-24">
      <Link
        href={`/${section.slug}`}
        className="text-sm text-[var(--text-tertiary)] transition-colors hover:text-[var(--text)]"
      >
        ← <T en={section.title} uk={section.titleUk} />
      </Link>

      <header className="mt-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          <T {...group.label} />
          <span className="ml-2.5 align-middle text-base font-normal text-[var(--text-tertiary)]">
            {group.items.length}
          </span>
        </h1>
      </header>

      <ShelfTypeClient
        sectionSlug={section.slug}
        items={group.items}
        categories={groupCategories(group)}
      />
    </div>
  );
}
