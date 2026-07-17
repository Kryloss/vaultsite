import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSections,
  getSectionBySlug,
  getEntries,
  getEntry,
  displayDate,
  readingStats,
} from "@/lib/vault";
import { renderMarkdown } from "@/lib/markdown";

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
  const stats = section.type === "posts" ? readingStats(entry.content) : null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-14 lg:py-24">
      <Link
        href={`/${section.slug}`}
        className="text-sm text-[var(--text-tertiary)] transition-colors hover:text-[var(--text)]"
      >
        ← {section.title}
      </Link>

      <header className="mt-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          {entry.title}
          {entry.draft && (
            <span className="ml-3 inline-block translate-y-[-3px] rounded-md bg-amber-500/15 px-2 py-0.5 align-middle text-xs font-medium text-amber-500">
              Draft
            </span>
          )}
        </h1>
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">
          {entry.date && (
            <time dateTime={entry.date}>{displayDate(entry.date)}</time>
          )}
          {entry.date && stats && " · "}
          {stats && (
            <span>
              {stats.minutes} min read · {stats.words.toLocaleString()} words
            </span>
          )}
        </p>
      </header>

      <article
        className="prose mt-8"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
