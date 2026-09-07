import type { Metadata } from "next";
import type { CSSProperties } from "react";
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
import { renderWithHeadings, resolveCoverUrl } from "@/lib/markdown";
import { firstAlbumUrl } from "@/lib/apple-music";
import { pageMeta } from "@/lib/metadata";
import { previewsInHtml } from "@/lib/previews";
import { getSiblings } from "@/lib/siblings";
import { getSeries, getSeriesOptions } from "@/lib/series";
import {
  categoryLabel,
  categorySlug,
  entryCreator,
  entryMedium,
  isShelfSection,
  opensWithHeaderBlock,
  mediumSlug,
  toShelfItem,
} from "@/lib/shelf";
import { ui } from "@/lib/ui-strings";
import Creator from "@/components/Creator";
import { creatorHref } from "@/lib/shelf-creators";
import T from "@/components/T";
import Toc from "@/components/Toc";
import EntryFooter from "@/components/EntryFooter";
import Series from "@/components/Series";
import LinkPreview from "@/components/LinkPreview";
import CopyMarkdown, { CopyMarkdownTitle } from "@/components/CopyMarkdown";
import ReadingProgress from "@/components/ReadingProgress";
import MusicSheet from "@/components/MusicSheet";
import NoteCover from "@/components/NoteCover";
import ReadingPosition from "@/components/ReadingPosition";
import NoteThumbFit from "@/components/NoteThumbFit";
import JsonLd from "@/components/JsonLd";
import { breadcrumbJsonLd, entryJsonLd } from "@/lib/jsonld";
import { maturityOf } from "@/lib/maturity";
import { NOTE_THUMB_FIT_SCRIPT } from "@/lib/note-thumb";
import Page from "@/components/Page";
import DevEntryOptionsSlot from "@/components/DevEntryOptionsSlot";

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
  // Shelf and music entries render a headerless table as a plain fact list
  // instead of a card — see RenderOptions.factTables. Scoped here rather than
  // in the pipeline because it answers a problem only these pages have: the
  // creator block above it is already a block, and two of them stack badly.
  const factTables = opensWithHeaderBlock(section);
  /* People notes keep the CARD their table has always had (#87) — `factTables`
     stays off for them — but their facts still travel, up into the rail under
     the portrait. Detection of what a fact block IS lives in one place either
     way; see rehypeFactTables. */
  const liftFacts = factTables || section.type === "people";
  /* The rating rides into the fact list as a row rather than sitting on the
     metadata line — see DECISIONS #88. Per-language, because the label is. */
  const rating =
    factTables && typeof entry.meta.rating === "number"
      ? entry.meta.rating
      : undefined;
  const en = await renderWithHeadings(entry.content, entry.sectionDir, sectionSlug, {
    anchorLabel: ui.headingAnchor.en,
    factTables,
    /* The fact list comes back on its own so it can be placed somewhere the
       article isn't: the shelf's gutter column (#120), or the foot of a
       People note's contents rail (#121). Wherever it can't go, the page
       renders it back exactly where it came from. */
    liftFacts,
    rating,
    ratingLabel: ui.ratingRow.en,
  });
  const uk = entry.contentUk
    ? await renderWithHeadings(entry.contentUk, entry.sectionDir, sectionSlug, {
        idPrefix: "uk-",
        anchorLabel: ui.headingAnchor.uk,
        factTables,
        liftFacts,
        rating,
        ratingLabel: ui.ratingRow.uk,
      })
    : null;
  const stats = section.type === "posts" ? readingStats(entry.content) : null;
  const categories = parseCategories(entry.meta);
  const sectionEntries = getEntries(section);
  const categoryOptions = [
    ...new Set(sectionEntries.flatMap((candidate) => parseCategories(candidate.meta))),
  ].sort((a, b) => a.localeCompare(b));
  const seriesOptions =
    process.env.NODE_ENV === "development" ? getSeriesOptions() : [];
  const { prev, next } = getSiblings(section.slug, entry.slug);
  // Null unless `series:` names an arc with a second published part.
  const series = getSeries(section.slug, entry.slug);
  const showToc = en.headings.length >= MIN_TOC_HEADINGS;

  // Category chips link back to the section, pre-filtered. Shelf entries get
  // their medium's category page; everything else (posts) gets the section
  // page with `?category=`, which its list reads on arrival.
  const medium = entryMedium(entry);
  /* Who made it — a portrait, their role and a sentence, rendered above the
     note's own body. Shelf and music only: a post's author is Kyrylo, which
     the whole site already says, and the People section's entries ARE the
     person. On a music note the key is `artist:` and the role reads Artist;
     `entryCreator` picks that from the key itself, so nothing here has to
     know which section it is. */
  const creator = opensWithHeaderBlock(section) ? entryCreator(entry) : undefined;
  /* Where the creator's name leads, on the mediums that group by maker — a
     game's studio has a shelf of its own (#139). Undefined everywhere else,
     and the block renders as the plain text it always was. */
  const creatorLink =
    creator && medium
      ? creatorHref(sectionEntries, entry, section.slug, mediumSlug(medium))
      : undefined;
  /* Music notes tint their opening with their own cover, the way the section's
     track list is tinted by the newest one — so a note and the list it came
     from read as the same place. Music only: a shelf note already opens with
     the artwork itself on the card in every list that links to it, and a
     second, blurrier copy of it behind the title adds nothing. */
  /* A film or show shows its poster in the right gutter, the way a music note
     shows its album (#115). Reuses `toShelfItem` rather than resolving the
     cover again here, so the note and every card that links to it are looking
     at the same resolved artwork, blur placeholder and srcset. */
  /* Resolved ONCE for both places a shelf note can show its own artwork: the
     poster in the desktop gutter, and the thumbnail beside the title on a
     phone. `toShelfItem` rather than a second `resolveCoverUrl` here, so the
     note and every card that links to it look at the same resolved artwork,
     blur placeholder and srcset.

     A video is excluded from both: its cover is a YouTube thumbnail derived
     from the link, and the note embeds that video a few lines below — the
     poster would be the still of the thing already playing under it. That is
     the ONE medium the gutter shows no artwork for, and it is why `isVideo`
     is tested here rather than in the two places that read this (#135). */
  const art =
    isShelfSection(section) || section.type === "people"
      ? toShelfItem(entry)
      : undefined;
  const noteArt = art?.coverUrl && !art.isVideo ? art : undefined;
  /* EVERY SHELF MEDIUM, not just the two screen-shaped ones (#135). A book's
     face was left out of the gutter by #115 on the grounds that it already
     has a spines row and a medium page — but so does a film have a poster
     grid, and what the gutter is actually for is the note in front of you.
     People are the exception that stays: a person's portrait belongs at the
     head of the contents rail (#121), not in a column of its own. */
  const gutterCover = isShelfSection(section) ? noteArt : undefined;
  /* A People note's own column: the portrait, and under it the "At a glance"
     block lifted out of the article — the shelf's arrangement (#120) applied
     to the one page whose subject IS a person (#121).

     It is parked at the HEAD OF THE CONTENTS RAIL rather than in a gutter of
     its own, because the person is what the whole page is about and there is
     nothing out there for it to compete with. In the rail rather than above
     it: a sibling would have to be told how tall a portrait and a fact list
     run, and a child simply follows.

     Above the outline rather than below it (#128), so the column reads the
     way a shelf note's does (#127): the subject first, then the navigation.
     The rail's hairline moved off the rail and onto `.toc-outline` in the
     same change — it marks the rows of a list, and there are no rows beside
     a photograph.

     The facts are rendered TWICE — here, and back in the article by the
     `.note-gutter` wrapper below. Only one is ever displayed (the rail is
     `display: none` below 1168px, and the inline copy is hidden above it when
     this one exists), so a screen reader meets exactly one at any width. It is
     the same trade the outline itself makes between the rail and the phone
     sheet: two copies of one short block beats moving it between two parents,
     which CSS cannot do.

     The picture is decorative, hence `alt=""` — the note's <h1> is the
     person's name, on the same screen. */
  const personBlock =
    section.type === "people" && (noteArt?.coverUrl || en.factsHtml) ? (
      <>
        {noteArt?.coverUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            className="toc-portrait"
            src={noteArt.coverUrl}
            srcSet={noteArt.coverSrcSet}
            /* 13rem minus the rail's own indent. */
            sizes="196px"
            alt=""
            aria-hidden="true"
            loading="lazy"
            style={
              {
                "--cover-ar": noteArt.coverAr ?? 1,
                ...(noteArt.coverBlur
                  ? { backgroundImage: `url("${noteArt.coverBlur}")` }
                  : null),
              } as CSSProperties
            }
          />
        )}
        {/* No `.prose` on this copy, deliberately: the card treatment a People
            note's table keeps in the article (#87) is written against that
            ancestor, and at 195px there is no card to keep — the pair stacks,
            label over value. Styling it from nothing is shorter than undoing
            the card. */}
        {en.factsHtml && (
          <div
            className={`toc-facts${uk ? " lang-en" : ""}`}
            dangerouslySetInnerHTML={{ __html: en.factsHtml }}
          />
        )}
        {uk?.factsHtml && (
          <div
            className="toc-facts lang-uk"
            lang="uk"
            dangerouslySetInnerHTML={{ __html: uk.factsHtml }}
          />
        )}
      </>
    ) : null;
  const noteWash =
    section.type === "music"
      ? resolveCoverUrl(entry.sectionDir, entry.meta.cover)
      : undefined;
  /* Phones get the album as an icon in the corner instead of a 450px slab in
     the middle of the writing — see components/MusicSheet.tsx. Both language
     bodies embed the same album, so one URL serves either. */
  const albumUrl =
    section.type === "music" ? firstAlbumUrl(entry.content) : undefined;

  /* The wrapper below exists whenever the note has header matter of its own.
     It is also where the contents rail goes when that matter takes the gutter
     — see the comment on `.note-gutter` in the JSX. */
  const hasGutter = Boolean(gutterCover?.coverUrl || creator || en.factsHtml);
  /* WHAT MAKES THE WRAPPER A COLUMN, and it is a marker rather than the
     poster's own presence (#135). Every shelf note's header matter goes to
     the gutter at 1168px — including a VIDEO's, which has no artwork to put
     above it — so the CSS can no longer ask `:has(.note-cover)` and get the
     right answer. It has to be told, because the other two sections that
     render this wrapper want something else out there: a music note has the
     album player in that gutter (#98), and a People note has its portrait at
     the head of the rail (#121). */
  const gutterColumn = isShelfSection(section) && hasGutter;
  /* A People note's facts keep the CARD every prose table has (#87) — shelf
     and music notes get the plain list instead, via `factTables`. The card
     needs its own colour and spacing here, so it is named rather than left to
     be inferred from the absence of `.fact-table`. See `.person-facts`. */
  const factsCard = section.type === "people" ? " person-facts" : "";
  const toc = showToc ? (
    <Toc
      title={entry.title}
      titleUk={entry.titleUk}
      en={en.headings}
      uk={uk?.headings}
      above={personBlock}
    />
  ) : null;

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
      /* Scopes the gutter player to music notes only — an album link pasted
         into a post keeps its place in the writing (#94). */
      className={section.type === "music" ? "music-note" : ""}
      data-vault-source={`vault/${entry.sectionDir}/${entry.fileName}.md`}
      data-vault-source-uk={
        entry.contentUk
          ? `vault/${entry.sectionDir}/${entry.fileName}.uk.md`
          : undefined
      }
      data-dev-vault-source={`vault/${entry.sectionDir}/${entry.fileName}.md`}
      data-dev-vault-source-uk={
        entry.contentUk
          ? `vault/${entry.sectionDir}/${entry.fileName}.uk.md`
          : undefined
      }
    >
      {noteWash && (
        /* The note's own artwork, blurred past recognition, dissolving behind
           its opening. A WASH, not a card: `.creator` is deliberately a row
           with no border, fill or radius (#86), and framing it here would
           reverse that. Decorative — the cover is legible on the section's
           list and inside the note's own player. */
        <div className="note-wash" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={noteWash} alt="" />
        </div>
      )}

      <JsonLd data={entryJsonLd(section, entry)} />
      <JsonLd data={breadcrumbJsonLd(section, entry)} />
      {/* `minutes` also drives the time-remaining pill — posts only. */}
      <ReadingProgress minutes={stats?.minutes} />
      <ReadingPosition />
      {albumUrl && <MusicSheet url={albumUrl} cover={noteWash} />}
      {/* Hover cards for the internal links in THIS note only — see
          previewsInHtml() in lib/previews.ts. */}
      <LinkPreview previews={previewsInHtml(en.html + (en.factsHtml ?? ""), uk && uk.html + (uk.factsHtml ?? ""))} />

      {/* On a PHONE the note's own artwork sits to the left of the title, and
          nowhere else: `.note-thumb` is `display: none` from 640px up, where
          a film or show hands the job to the gutter poster instead. The
          wrapper div is only rendered when there is artwork, so every other
          note's header keeps the shape it has always had. */}
      {/* suppressHydrationWarning: the inline script below writes the measured
          `--note-thumb-fit` onto this element before React hydrates (#134), so
          the server's HTML and the DOM differ here on purpose — the same
          arrangement the language script has with <html data-lang>. */}
      <header
        className={noteArt ? "note-header" : undefined}
        suppressHydrationWarning={Boolean(noteArt)}
      >
        {noteArt && (
          /* Decorative, hence `alt=""` — the <h1> beside it names the work on
             the same line, so announcing the cover would be the title twice.
             `loading="lazy"` is load-bearing rather than an optimisation: on a
             wide window this image is `display: none`, and a lazy image that
             is never displayed is never FETCHED (#95), so a desktop reader
             does not pay for the phone's copy of the artwork. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="note-thumb"
            src={noteArt.coverUrl}
            srcSet={noteArt.coverSrcSet}
            /* Never painted wider than the 6rem reserve, so a 2x phone wants
               the 256w variant. */
            sizes="96px"
            alt=""
            aria-hidden="true"
            loading="lazy"
            /* THE RATIO, AS ATTRIBUTES, and they are load-bearing (#133). The
               thumbnail is sized `height: 100%; width: auto`, so its width is
               the transfer through the artwork's own ratio — which a
               not-yet-loaded image does not have, and `width: auto` then
               resolves to 0. The attributes give the box that ratio before
               the first byte arrives, so the picture is drawn at its size
               rather than arriving at it. Only the RATIO is used (CSS sets
               both axes), hence the round 1000; a cover with no measured
               dimensions — an external `cover:` URL, which the image manifest
               never sees — falls back to a square, as it always did. */
            width={1000}
            height={Math.round(1000 * (noteArt.coverAr ?? 1))}
            style={
              {
                ...(noteArt.coverBlur
                  ? { backgroundImage: `url("${noteArt.coverBlur}")` }
                  : null),
              } as CSSProperties
            }
          />
        )}
        <div className="note-header-text">
          <h1 className="page-title text-2xl font-semibold tracking-tight text-[var(--text)]">
            {/* Raw vault source, in whichever language is showing. Sits to the
                left of the title and stays hidden until the heading is
                hovered/focused — same reveal-on-hover treatment as the ToC pill. */}
            <CopyMarkdown en={entry.content} uk={entry.contentUk} />
            <CopyMarkdownTitle
              en={entry.content}
              uk={entry.contentUk}
              devFieldEn="title"
              devFieldUk="title_uk"
            >
              <T en={entry.title} uk={entry.titleUk} />
            </CopyMarkdownTitle>
            {entry.draft && (
              <span className="draft-chip draft-chip-title">
                <T {...ui.draft} />
              </span>
            )}
          </h1>
          {/* Date · reading stats · maturity · series · #tags. */}
          {metaLine}
        </div>
      </header>

      {/* THE ARTWORK'S WIDTH, HANDED BACK TO THE TITLE (#134). CSS draws the
          picture at the header's own height and the artwork's ratio, and then
          has no way to tell the text how wide it came out — the offset decides
          the wrap, the wrap decides the height, and the height is what the
          width was derived from. So it is measured: once here, while the
          parser is still working and before the page is first drawn, and again
          at hydration and on every resize by the component beside it. Both
          read lib/note-thumb.ts; neither is load-bearing, since the CSS on its
          own is correct at the full 6rem reserve. */}
      {noteArt && (
        <>
          <script
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: NOTE_THUMB_FIT_SCRIPT }}
          />
          <NoteThumbFit />
        </>
      )}

      <DevEntryOptionsSlot
        source={`vault/${entry.sectionDir}/${entry.fileName}.md`}
        sectionType={section.type}
        medium={medium}
        draft={entry.draft}
        date={entry.date}
        status={typeof entry.meta.status === "string" ? entry.meta.status : undefined}
        rating={typeof entry.meta.rating === "number" ? entry.meta.rating : undefined}
        cover={typeof entry.meta.cover === "string" ? entry.meta.cover : undefined}
        categories={categories}
        series={typeof entry.meta.series === "string" ? entry.meta.series : undefined}
        seriesUk={typeof entry.meta.series_uk === "string" ? entry.meta.series_uk : undefined}
        part={typeof entry.meta.part === "number" ? entry.meta.part : undefined}
        categoryOptions={categoryOptions}
        seriesOptions={seriesOptions}
      />

      {/* The note's header matter that is ABOUT THE WORK rather than part of
          the writing: the poster, and the person who made it.

          One wrapper, because on a wide window these become a single column
          in the right gutter — artwork on top, creator beneath it (#115),
          then the facts and the outline (#127). They stack in normal flow
          inside it, so nothing has to know how tall a bio runs. `display:
          contents` everywhere else, so at every other width the creator block
          is exactly where it has always been, above the note's "At a glance"
          table — see components/Creator.tsx.

          `data-column` is what turns it into that column, and a VIDEO note
          takes it with no artwork at all: the player it would show a still of
          is a few lines below (#135). */}
      {hasGutter && (
        <div className="note-gutter" data-column={gutterColumn ? "" : undefined}>
          {gutterCover?.coverUrl && (
            <NoteCover
              src={gutterCover.coverUrl}
              srcSet={gutterCover.coverSrcSet}
              blur={gutterCover.coverBlur}
              ar={gutterCover.coverAr}
            />
          )}
          {creator && <Creator creator={creator} href={creatorLink} />}
          {/* The note's own fact list, lifted out of the article by
              `liftFacts` so it can be a SIBLING of the poster and the creator
              rather than the first thing inside the writing. It keeps `.prose`
              because every rule that styles it is written against that
              ancestor, and `mt-8` because that is the margin the article used
              to give it — below 1168px this renders in exactly the place, and
              with exactly the spacing, it had before. */}
          {en.factsHtml && (
            <div
              className={`prose note-facts${factsCard} mt-8${uk ? " lang-en" : ""}`}
              dangerouslySetInnerHTML={{ __html: en.factsHtml }}
            />
          )}
          {uk?.factsHtml && (
            <div
              className={`prose note-facts${factsCard} mt-8 lang-uk`}
              lang="uk"
              dangerouslySetInnerHTML={{ __html: uk.factsHtml }}
            />
          )}
          {/* LAST IN THE COLUMN, and a child rather than a sibling for the
              same reason the People portrait is a child of the rail (#121):
              what stands above it here is a poster, a bio and a fact list,
              and only a child follows a stack whose height nobody can name.
              A sibling would have to be told it, and a custom property can
              measure a poster but not a paragraph of prose.

              Everywhere the column does not exist the wrapper is `display:
              contents` and the rail is the fixed element it has always been,
              so this position in the markup costs nothing at those widths. */}
          {toc}
        </div>
      )}

      {uk ? (
        <>
          <article
            className="prose mt-8 lang-en"
            data-dev-body-field="body"
            dangerouslySetInnerHTML={{ __html: en.html }}
          />
          <article
            className="prose mt-8 lang-uk"
            lang="uk"
            data-dev-body-field="body_uk"
            dangerouslySetInnerHTML={{ __html: uk.html }}
          />
        </>
      ) : (
        <article
          className="prose mt-8"
          data-dev-body-field="body"
          dangerouslySetInnerHTML={{ __html: en.html }}
        />
      )}

      <EntryFooter prev={prev} next={next} />

      {/* The rail, unless the gutter wrapper above is already holding it. */}
      {!hasGutter && toc}
      {/* No outline, so no rail to hang the portrait under — it takes the
          rail's own place instead. A People note with two headings (an "At a
          glance" and a "Sources", which is a perfectly ordinary short one)
          falls below MIN_TOC_HEADINGS, so this is a real path, not a
          theoretical one. */}
      {!showToc && personBlock && (
        <aside className="note-portrait">{personBlock}</aside>
      )}
    </Page>
  );
}
