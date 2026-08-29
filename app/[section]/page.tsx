import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSections, getSectionBySlug, getEntries, parseCategories } from "@/lib/vault";
import { renderMarkdown } from "@/lib/markdown";
import { pageMeta } from "@/lib/metadata";
import { previewsInHtml } from "@/lib/previews";
import { getListComponent, listRendersBody } from "@/lib/section-types";
import { ui } from "@/lib/ui-strings";
import T from "@/components/T";
import JsonLd from "@/components/JsonLd";
import LinkPreview from "@/components/LinkPreview";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import Page from "@/components/Page";
import DevCreateEntrySlot from "@/components/DevCreateEntrySlot";

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
  const categoryOptions = [...new Set(entries.flatMap((entry) => parseCategories(entry.meta)))].sort(
    (a, b) => a.localeCompare(b)
  );

  /* The section's own prose. Most types print it here, above the list; the
     few that place it themselves (music puts it under the playlist embed)
     take it as a prop instead — see `listRendersBody`. */
  const body =
    html && htmlUk ? (
      <>
        <article
          className="prose mt-6 lang-en"
          data-dev-body-field="body"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <article
          className="prose mt-6 lang-uk"
          lang="uk"
          data-dev-body-field="body_uk"
          dangerouslySetInnerHTML={{ __html: htmlUk }}
        />
      </>
    ) : html ? (
      <article
        className="prose mt-6"
        data-dev-body-field="body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    ) : null;
  const ownBody = listRendersBody(section.type);

  return (
    <Page
      data-dev-vault-source={`vault/${section.dirName}/main.md`}
      data-dev-vault-source-uk={
        section.contentUk !== undefined
          ? `vault/${section.dirName}/main.uk.md`
          : undefined
      }
    >
      <JsonLd data={breadcrumbJsonLd(section)} />
      {/* Hover cards for the internal links in this section's own prose. The
          entry list below links to notes too, but those rows already show a
          title and a date — a card repeating them adds nothing. */}
      <LinkPreview previews={previewsInHtml(html, htmlUk)} />
      <header>
        <div className="dev-page-title-row">
          <h1
            className="page-title text-2xl font-semibold tracking-tight text-[var(--text)]"
            data-dev-field-en="title"
            data-dev-field-uk="title_uk"
          >
            <T en={section.title} uk={section.titleUk} />
          </h1>
          <DevCreateEntrySlot
            sectionSource={`vault/${section.dirName}/main.md`}
            sectionType={section.type}
            sectionTitle={section.title}
            categories={categoryOptions}
          />
        </div>
        {section.description && (
          <p
            className="mt-2 text-[var(--text-secondary)]"
            data-dev-field-en="description"
            data-dev-field-uk="description_uk"
          >
            <T en={section.description} uk={section.descriptionUk} />
          </p>
        )}
      </header>

      {!ownBody && body}

      <List
        section={section}
        entries={entries}
        body={ownBody ? body : undefined}
      />
    </Page>
  );
}
