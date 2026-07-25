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
import { renderMarkdown } from "@/lib/markdown";
import {
  categoryLabel,
  categorySlug,
  isShelfSection,
  mediumSlug,
} from "@/lib/shelf";
import { ui } from "@/lib/ui-strings";
import Stars from "@/components/Stars";
import T from "@/components/T";

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
  return { title: entry.title, description: entry.description };
}

/** Entry page — an individual .md file, e.g. /posts/how-was-my-day. */
export default async function EntryPage({ params }: Props) {
  const { section: sectionSlug, slug } = await params;
  const section = getSectionBySlug(sectionSlug);
  const entry = getEntry(sectionSlug, slug);
  if (!section || !entry) notFound();

  const html = await renderMarkdown(entry.content, entry.sectionDir, sectionSlug);
  const htmlUk = entry.contentUk
    ? await renderMarkdown(entry.contentUk, entry.sectionDir, sectionSlug)
    : null;
  const stats = section.type === "posts" ? readingStats(entry.content) : null;
  const categories = parseCategories(entry.meta);

  // Shelf entries link each category to its medium page, pre-filtered.
  const medium =
    typeof entry.meta.medium === "string"
      ? entry.meta.medium.toLowerCase()
      : undefined;
  const categoryHref = (category: string) =>
    isShelfSection(section) && medium
      ? `/${section.slug}/type/${mediumSlug(medium)}/${categorySlug(category)}`
      : undefined;

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
        </h1>
        {/* `categories:` frontmatter, styled like the filter chips they lead
            to. On a shelf entry each one opens its medium page with that
            category pre-selected; elsewhere there's no such page, so they
            render as plain chips. Names are raw strings, identical in both
            languages (same as the posts' category chips). */}
        {categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((c) => {
              const href = categoryHref(c);
              const base =
                "rounded-full border border-[var(--border)] px-3 py-1 text-sm text-[var(--text-secondary)] transition-colors";
              return href ? (
                <Link
                  key={c}
                  href={href}
                  className={`${base} hover:border-[var(--text-tertiary)] hover:text-[var(--text)]`}
                >
                  <T {...categoryLabel(c)} />
                </Link>
              ) : (
                <span key={c} className={base}>
                  <T {...categoryLabel(c)} />
                </span>
              );
            })}
          </div>
        )}

        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-[var(--text-tertiary)]">
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
        </p>

      </header>

      {htmlUk ? (
        <>
          <article
            className="prose mt-8 lang-en"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <article
            className="prose mt-8 lang-uk"
            dangerouslySetInnerHTML={{ __html: htmlUk }}
          />
        </>
      ) : (
        <article
          className="prose mt-8"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}
