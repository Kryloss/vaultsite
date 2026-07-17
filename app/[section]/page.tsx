import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSections, getSectionBySlug, getEntries } from "@/lib/vault";
import { renderMarkdown } from "@/lib/markdown";
import { getListComponent } from "@/lib/section-types";

interface Props {
  params: Promise<{ section: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getSections().map((s) => ({ section: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section: slug } = await params;
  const section = getSectionBySlug(slug);
  if (!section) return {};
  return { title: section.title, description: section.description };
}

/** Section page — vault/<Folder>/main.md plus its entry list. */
export default async function SectionPage({ params }: Props) {
  const { section: slug } = await params;
  if (slug === "home") redirect("/");

  const section = getSectionBySlug(slug);
  if (!section) notFound();

  const entries = getEntries(section);
  const html = section.content.trim()
    ? await renderMarkdown(section.content, section.dirName, section.slug)
    : "";
  const List = getListComponent(section.type);

  return (
    <div className="mx-auto max-w-2xl px-6 py-14 lg:py-24">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          {section.icon && <span className="mr-2">{section.icon}</span>}
          {section.title}
        </h1>
        {section.description && (
          <p className="mt-2 text-[var(--text-secondary)]">
            {section.description}
          </p>
        )}
      </header>

      {html && (
        <article
          className="prose mt-6"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}

      <List section={section} entries={entries} />
    </div>
  );
}
