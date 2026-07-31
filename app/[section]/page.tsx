import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSections, getSectionBySlug, getEntries } from "@/lib/vault";
import { renderMarkdown } from "@/lib/markdown";
import { pageMeta } from "@/lib/metadata";
import { getListComponent } from "@/lib/section-types";
import { ui } from "@/lib/ui-strings";
import T from "@/components/T";
import JsonLd from "@/components/JsonLd";
import { breadcrumbJsonLd } from "@/lib/jsonld";

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
  return {
    title: section.title,
    description: section.description,
    // "home" is served at "/" — its canonical is the site root, not /home.
    ...pageMeta({ path: slug === "home" ? "/" : `/${slug}` }),
  };
}

/** Section page — vault/<Folder>/main.md plus its entry list. */
export default async function SectionPage({ params }: Props) {
  const { section: slug } = await params;
  if (slug === "home") redirect("/");

  const section = getSectionBySlug(slug);
  if (!section) notFound();

  const entries = getEntries(section);
  const html = section.content.trim()
    ? await renderMarkdown(section.content, section.dirName, section.slug, {
        anchorLabel: ui.headingAnchor.en,
      })
    : "";
  // Both bodies share this document, so the Ukrainian one needs its own id
  // namespace — same reasoning as entry pages, see lib/toc.ts.
  const htmlUk = section.contentUk?.trim()
    ? await renderMarkdown(section.contentUk, section.dirName, section.slug, {
        idPrefix: "uk-",
        anchorLabel: ui.headingAnchor.uk,
      })
    : "";
  const List = getListComponent(section.type);

  return (
    <div className="mx-auto max-w-2xl px-6 py-14 lg:py-24">
      <JsonLd data={breadcrumbJsonLd(section)} />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          {section.icon && <span className="mr-2">{section.icon}</span>}
          <T en={section.title} uk={section.titleUk} />
        </h1>
        {section.description && (
          <p className="mt-2 text-[var(--text-secondary)]">
            <T en={section.description} uk={section.descriptionUk} />
          </p>
        )}
      </header>

      {html && htmlUk ? (
        <>
          <article
            className="prose mt-6 lang-en"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <article
            className="prose mt-6 lang-uk"
            lang="uk"
            dangerouslySetInnerHTML={{ __html: htmlUk }}
          />
        </>
      ) : html ? (
        <article
          className="prose mt-6"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : null}

      <List section={section} entries={entries} />
    </div>
  );
}
