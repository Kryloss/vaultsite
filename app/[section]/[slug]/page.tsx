import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSections,
  getSectionBySlug,
  getEntries,
  getEntry,
  displayDate,
  displayDateUk,
  readingStats,
  parseCategories,
} from "@/lib/vault";
import { renderWithHeadings } from "@/lib/markdown";
import { pageMeta } from "@/lib/metadata";
import { previewsInHtml } from "@/lib/previews";
import { getSiblings } from "@/lib/siblings";
import { getSeries } from "@/lib/series";
import {
  categoryLabel,
  categorySlug,
  entryMedium,
  isShelfSection,
  mediumSlug,
} from "@/lib/shelf";
import { ui } from "@/lib/ui-strings";
import Stars from "@/components/Stars";
import T from "@/components/T";
import Toc from "@/components/Toc";
import EntryFooter from "@/components/EntryFooter";
import Series from "@/components/Series";
import LinkPreview from "@/components/LinkPreview";
import CopyMarkdown from "@/components/CopyMarkdown";
import ReadingProgress from "@/components/ReadingProgress";
import ReadingPosition from "@/components/ReadingPosition";
import JsonLd from "@/components/JsonLd";
import { breadcrumbJsonLd, entryJsonLd } from "@/lib/jsonld";
import { maturityOf } from "@/lib/maturity";

/** Below this many h2/h3 an outline is noise, not navigation. */
const MIN_TOC_HEADINGS = 3;

interface Props {
  params: Promise<{ section: string; slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getSections().flatMap((section) =>
    getEntries(section).map((entry) => ({
      section: section.slug,
      slug: entry.slug,
    }))
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section, slug } = await params;
  const entry = getEntry(section, slug);
  if (!entry) return {};
  return {
    title: entry.title,
    description: entry.description,
    ...pageMeta({ path: `/${section}/${slug}`, publishedTime: entry.date }),
  };
}

/** Entry page — an individual .md file, e.g. /posts/how-was-my-day. */
export default async function EntryPage({ params }: Props) {
  const { section: sectionSlug, slug } = await params;
  const section = getSectionBySlug(sectionSlug);
  const entry = getEntry(sectionSlug, slug);
  if (!section || !entry) notFound();

  // The Ukrainian body renders as a second <article> in the same document, so
  // its heading ids are namespaced to keep "#setup" unambiguous — see lib/toc.ts.
  const en = await renderWithHeadings(entry.content, entry.sectionDir, sectionSlug, {
    anchorLabel: ui.headingAnchor.en,
  });
  const uk = entry.contentUk
    ? await renderWithHeadings(entry.contentUk, entry.sectionDir, sectionSlug, {
        idPrefix: "uk-",
        anchorLabel: ui.headingAnchor.uk,
      })
    : null;
  const stats = section.type === "posts" ? readingStats(entry.content) : null;
  const categories = parseCategories(entry.meta);
  const { prev, next } = getSiblings(section.slug, entry.slug);
  // Null unless `series:` names an arc with a second published part.
  const series = getSeries(section.slug, entry.slug);
  const showToc = en.headings.length >= MIN_TOC_HEADINGS;

  // Category chips link back to the section, pre-filtered. Shelf entries get
  // their medium's category page; everything else (posts) gets the section
  // page with `?category=`, which its list reads on arrival.
  const medium = entryMedium(entry);
  const categoryHref = (category: string) =>
    isShelfSection(section) && medium
      ? `/${section.slug}/type/${mediumSlug(medium)}/${categorySlug(category)}`
      : `/${section.slug}?category=${encodeURIComponent(category)}`;

  return (
    /* The note's own vault paths ride on the page so page-agnostic components
       can find them — the Cmd+K "open on GitHub" action reads these rather
       than having every entry's file path threaded through the layout. Same
       read-the-page approach as the prev/next shortcuts. */
    <div
      className="mx-auto max-w-2xl px-6 py-14 lg:py-24"
      data-vault-source={`vault/${entry.sectionDir}/${entry.fileName}.md`}
      data-vault-source-uk={
        entry.contentUk
          ? `vault/${entry.sectionDir}/${entry.fileName}.uk.md`
          : undefined
      }
    >
      <JsonLd data={entryJsonLd(section, entry)} />
      <JsonLd data={breadcrumbJsonLd(section, entry)} />
      {/* `minutes` also drives the time-remaining pill — posts only. */}
      <ReadingProgress minutes={stats?.minutes} />
      <ReadingPosition />
      {/* Hover cards for the internal links in THIS note only — see
          previewsInHtml() in lib/previews.ts. */}
      <LinkPreview previews={previewsInHtml(en.html, uk?.html)} />
      <Link
        href={`/${section.slug}`}
        className="text-sm text-[var(--text-tertiary)] transition-colors hover:text-[var(--text)]"
      >
        ← <T en={section.title} uk={section.titleUk} />
      </Link>

      <header className="mt-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          <T en={entry.title} uk={entry.titleUk} />
          {typeof entry.meta.rating === "number" && (
            <Stars
              rating={entry.meta.rating}
              size={16}
              className="ml-3 translate-y-[-2px] align-middle"
            />
          )}
          {entry.draft && (
            <span className="ml-3 inline-block translate-y-[-3px] rounded-md bg-amber-500/15 px-2 py-0.5 align-middle text-xs font-medium text-amber-500">
              <T {...ui.draft} />
            </span>
          )}
          {/* Raw vault source, in whichever language is showing. */}
          <CopyMarkdown en={entry.content} uk={entry.contentUk} />
        </h1>
        {/* `categories:` frontmatter, styled like the filter chips they lead
            to. On a shelf entry each one opens its medium page with that
            category pre-selected; elsewhere there's no such page, so they
            render as plain chips. Names are raw strings, identical in both
            languages (same as the posts' category chips). */}
        {categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link
                key={c}
                href={categoryHref(c)}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--text-tertiary)] hover:text-[var(--text)]"
              >
                <T {...categoryLabel(c)} />
              </Link>
            ))}
          </div>
        )}

        {/* A <div>, not a <p>: the series popover is a <nav>, which a browser
            parsing the static HTML would kick out of a paragraph — and the
            resulting DOM wouldn't match what React rendered. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-[var(--text-tertiary)]">
          {entry.date && (
            <time dateTime={entry.date}>
              <T en={displayDate(entry.date)} uk={displayDateUk(entry.date)} />
            </time>
          )}
          {entry.date && stats && <span aria-hidden>·</span>}
          {stats && (
            <span>
              {stats.minutes} <T {...ui.minRead} /> ·{" "}
              {stats.words.toLocaleString()} <T {...ui.words} />
            </span>
          )}
          {/* Maturity is a writing idea, so it rides with the writing stats.
              Unset notes fall back to Seedling — see lib/maturity.ts. */}
          {stats && (
            <span className="maturity">
              <span aria-hidden>{maturityOf(entry.meta).icon}</span>
              <T {...maturityOf(entry.meta).label} />
            </span>
          )}
          {/* "Part 2 of 5" — a badge that opens the list of parts. Someone
              landing here from search is starting in the middle and should
              know it, but the other parts are a detour, not the article, so
              they live in a popover rather than a panel of their own. */}
          {series && (entry.date || stats) && <span aria-hidden>·</span>}
          {series && <Series series={series} />}
        </div>

      </header>

      {uk ? (
        <>
          <article
            className="prose mt-8 lang-en"
            dangerouslySetInnerHTML={{ __html: en.html }}
          />
          <article
            className="prose mt-8 lang-uk"
            lang="uk"
            dangerouslySetInnerHTML={{ __html: uk.html }}
          />
        </>
      ) : (
        <article
          className="prose mt-8"
          dangerouslySetInnerHTML={{ __html: en.html }}
        />
      )}

      <EntryFooter prev={prev} next={next} />

      {showToc && (
        <Toc
          title={entry.title}
          titleUk={entry.titleUk}
          en={en.headings}
          uk={uk?.headings}
        />
      )}
    </div>
  );
}
