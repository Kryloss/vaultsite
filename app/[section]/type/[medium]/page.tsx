import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSections, getSectionBySlug, getEntries } from "@/lib/vault";
import { isShelfSection, shelfGroupBySlug, shelfMediumSlugs } from "@/lib/shelf";
import { pageMeta } from "@/lib/metadata";
import { getBookQuotes } from "@/lib/quotes";
import ShelfTypeView from "@/components/lists/ShelfTypeView";
import T from "@/components/T";
import Page from "@/components/Page";

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
    ...pageMeta({ path: `/${sectionSlug}/type/${medium}` }),
  };
}

export default async function ShelfMediumPage({ params }: Props) {
  const { section: sectionSlug, medium } = await params;
  const section = getSectionBySlug(sectionSlug);
  if (!section || !isShelfSection(section)) notFound();

  const entries = getEntries(section);
  const group = shelfGroupBySlug(entries, medium);
  if (!group) notFound();

  return (
    <Page>
      <Link
        href={`/${section.slug}`}
        className="press inline-block text-sm text-[var(--text-tertiary)] hover:text-[var(--text)]"
      >
        ← <T en={section.title} uk={section.titleUk} />
      </Link>

      {/* Passed so the Quotes chip shows here too — the page it leads to is
          /books/quotes, handled by the [category] route. */}
      <ShelfTypeView
        sectionSlug={section.slug}
        group={group}
        quotes={group.medium === "book" ? getBookQuotes(entries) : undefined}
      />
    </Page>
  );
}
