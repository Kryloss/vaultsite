import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSections, getSectionBySlug, getEntries } from "@/lib/vault";
import { isShelfSection, shelfGroupBySlug, shelfMediumSlugs } from "@/lib/shelf";
import ShelfCard from "@/components/lists/ShelfCard";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";

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

      {/* Every card in here is the same shape, so a plain grid is safe. */}
      <ul
        className={`mt-8 grid gap-x-5 gap-y-10 ${
          group.items.some((i) => i.isVideo)
            ? "grid-cols-1 sm:grid-cols-2"
            : "grid-cols-2 sm:grid-cols-3"
        }`}
      >
        {group.items.map((item) => (
          <li key={item.slug}>
            <ShelfCard item={item} sectionSlug={section.slug} />
          </li>
        ))}
      </ul>
    </div>
  );
}
