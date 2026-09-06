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
import {
  CREATORS_SLUG,
  creatorGroupBySlug,
  hasCreatorPages,
  shelfCreatorGroups,
} from "@/lib/shelf-creators";
import ShelfTypeView from "@/components/lists/ShelfTypeView";
import T from "@/components/T";
import Page from "@/components/Page";

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
          /* One page per studio, plus the index they are chosen from — the
             same segment as a category, because a studio IS a facet of the
             same shelf (#139). `shelfCreatorGroups` has already dropped any
             name whose slug collides with a category above. */
          if (hasCreatorPages(group.medium)) {
            const creators = shelfCreatorGroups(
              getEntries(section),
              group.medium
            );
            if (creators.length > 0) {
              params.push({
                section: section.slug,
                medium: group.slug,
                category: CREATORS_SLUG,
              });
              for (const creator of creators)
                params.push({
                  section: section.slug,
                  medium: group.slug,
                  category: creator.slug,
                });
            }
          }
          return params;
        })
    );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section: sectionSlug, medium, category } = await params;
  const section = getSectionBySlug(sectionSlug);
  if (!section) return {};
  const entries = getEntries(section);
  const group = shelfGroupBySlug(entries, medium);
  if (!group) return {};
  /* A studio page is a real page and needs its own metadata; the category
     lookup would call it a 404. Quotes has always resolved this way too — the
     title is the medium's either way, since what is filtered shows as the
     active chip on the page rather than in the tab (#113). */
  const known =
    Boolean(categoryFromSlug(group, category)) ||
    category === QUOTES_SLUG ||
    category === CREATORS_SLUG ||
    Boolean(creatorGroupBySlug(entries, group.medium, category));
  if (!known) return {};
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

  /* Studios, where the medium has them: the index under its own segment, and
     one page per studio under the studio's slug (#139). */
  const creators = hasCreatorPages(group.medium)
    ? shelfCreatorGroups(entries, group.medium)
    : undefined;
  const showCreators =
    category === CREATORS_SLUG && Boolean(creators && creators.length > 0);
  const activeCreator = showCreators
    ? undefined
    : creatorGroupBySlug(entries, group.medium, category);

  /* A category is the only one of the four that resolves through frontmatter;
     the other three are segments this route reserves. */
  const name =
    showQuotes || showCreators || activeCreator
      ? undefined
      : categoryFromSlug(group, category);
  if (!name && !showQuotes && !showCreators && !activeCreator) notFound();

  return (
    <Page
      data-dev-vault-source={`vault/${section.dirName}/main.md`}
      data-dev-vault-source-uk={
        section.contentUk !== undefined
          ? `vault/${section.dirName}/main.uk.md`
          : undefined
      }
    >

      <ShelfTypeView
        sectionSlug={section.slug}
        group={group}
        activeCategory={name}
        quotes={quotes}
        showQuotes={showQuotes}
        creators={creators}
        showCreators={showCreators}
        activeCreator={activeCreator}
      />
    </Page>
  );
}
