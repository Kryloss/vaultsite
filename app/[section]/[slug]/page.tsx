import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
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
  entryCreator,
  entryMedium,
  isShelfSection,
  mediumSlug,
} from "@/lib/shelf";
import { ui } from "@/lib/ui-strings";
import Creator from "@/components/Creator";
import Stars from "@/components/Stars";
import T from "@/components/T";
import Toc from "@/components/Toc";
import EntryFooter from "@/components/EntryFooter";
import Series from "@/components/Series";
import LinkPreview from "@/components/LinkPreview";
import CopyMarkdown, { CopyMarkdownTitle } from "@/components/CopyMarkdown";
import ReadingProgress from "@/components/ReadingProgress";
import ReadingPosition from "@/components/ReadingPosition";
import JsonLd from "@/components/JsonLd";
import { breadcrumbJsonLd, entryJsonLd } from "@/lib/jsonld";
import { maturityOf } from "@/lib/maturity";
import Page from "@/components/Page";

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
  /* Who made it — a portrait, their role and a sentence, rendered above the
     note's own body. Shelf only: a post's author is Kyrylo, which the whole
     site already says, and the People section's entries ARE the person. */
  const creator = isShelfSection(section) ? entryCreator(entry) : undefined;

  const categoryHref = (category: string) =>
    isShelfSection(section) && medium
      ? `/${section.slug}/type/${mediumSlug(medium)}/${categorySlug(category)}`
      : `/${section.slug}?category=${encodeURIComponent(category)}`;

  /* Everything the header knows about the note, on ONE line, with a middot
     between each part.

     The pieces are collected into an array and joined rather than written out
     with `{a && b && <span>·</span>}` between them: that version had to name
     every pair that could be adjacent, and it was already wrong — the maturity
     ran straight into the word count with no separator, because nothing had
     been written for that particular pair. Joining a list can't have that bug.

     The `categories:` chips used to be a row of their own above this one. Two
     rows of metadata under a title is one more than the title deserves, and
     these are the same kind of thing as everything else here: something the
     note knows about itself (#66). */
  const meta: ReactNode[] = [];

  if (entry.date) {
    meta.push(
      <time dateTime={entry.date}>
        <T en={displayDate(entry.date)} uk={displayDateUk(entry.date)} />
      </time>
    );
  }

  if (stats) {
    /* Two entries, not one span with a middot typed inside it. That middot was
       surrounded by ordinary spaces while every other separator on the line is
       spaced by the row's `gap`, so the reading time and the word count sat
       visibly closer together than anything else. Anything that looks like a
       separator has to BE one. */
    meta.push(
      <span>
        {stats.minutes} <T {...ui.minRead} />
      </span>
    );
    meta.push(
      <span>
        {stats.words.toLocaleString()} <T {...ui.words} />
      </span>
    );
    /* Maturity is a writing idea, so it rides with the writing stats. Unset
       notes fall back to Seedling — see lib/maturity.ts. Word only: the
       seedling/tree glyph was the last emoji left on a reading page, and
       "Seedling" says it without one. */
    meta.push(
      <span className="maturity">
        <T {...maturityOf(entry.meta).label} />
      </span>
    );
  }

  /* "Part 2 of 5" — a badge that opens the list of parts. Someone landing here
     from search is starting in the middle and should know it, but the other
     parts are a detour, not the article, so they live in a popover rather than
     a panel of their own. */
  if (series) meta.push(<Series series={series} />);

  /* Last, and as ONE group: the hashes already separate the tags from each
     other, so the set takes a single middot in front of it rather than one
     apiece. On a shelf entry each opens its medium page with that category
     pre-selected; elsewhere there's no such page, so they're plain chips.
     Names are raw strings, identical in both languages. */
  if (categories.length > 0) {
    meta.push(
      <span className="entry-tags inline-flex flex-wrap items-baseline">
        {categories.map((c) => (
          <Link key={c} href={categoryHref(c)} className="press">
            <T {...categoryLabel(c)} />
          </Link>
        ))}
      </span>
    );
  }

  /* A <div>, not a <p>: the series popover is a <nav>, which a browser parsing
     the static HTML would kick out of a paragraph — and the resulting DOM
     wouldn't match what React rendered. */
  const metaLine = meta.length > 0 && (
    <div className="entry-meta mt-3 flex flex-wrap items-center gap-x-2 text-sm text-[var(--text-tertiary)]">
      {meta.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden>·</span>}
          {part}
        </Fragment>
      ))}
    </div>
  );

  return (
    /* The note's own vault paths ride on the page so page-agnostic components
       can find them — the Cmd+K "open on GitHub" action reads these rather
       than having every entry's file path threaded through the layout. Same
       read-the-page approach as the prev/next shortcuts. */
    <Page
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

      <header>
        <h1 className="page-title text-2xl font-semibold tracking-tight text-[var(--text)]">
          {/* Raw vault source, in whichever language is showing. Sits to the
              left of the title and stays hidden until the heading is
              hovered/focused — same reveal-on-hover treatment as the ToC pill. */}
          <CopyMarkdown en={entry.content} uk={entry.contentUk} />
          <CopyMarkdownTitle en={entry.content} uk={entry.contentUk}>
            <T en={entry.title} uk={entry.titleUk} />
          </CopyMarkdownTitle>
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
        </h1>
        {/* Date · reading stats · maturity · series · #tags — built above. */}
        {metaLine}

      </header>

      {/* Above the article, so it comes before the note's "At a glance"
          table — see components/Creator.tsx. */}
      {creator && <Creator creator={creator} />}

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
    </Page>
  );
}
