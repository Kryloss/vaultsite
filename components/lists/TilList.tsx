import Link from "next/link";
import type { ReactNode } from "react";
import type { ListProps } from "@/lib/section-types";
import { renderMarkdown } from "@/lib/markdown";
import { displayDate, displayDateUk } from "@/lib/vault";
import T from "@/components/T";
import NewBadge from "@/components/NewBadge";
import { ui } from "@/lib/ui-strings";
import { previewBodies } from "@/lib/til-preview";

/**
 * "projects" section type — TIL-style feed: entries rendered inline, newest
 * first. Long entries show the first ~1000 characters with a
 * "Continue reading" link to the entry's own full page.
 */
export default async function TilList({ section, entries }: ListProps) {
  if (entries.length === 0) {
    return (
      <p className="mt-10 text-sm text-[var(--text-tertiary)]">
        <T {...ui.emptyState} />
      </p>
    );
  }

  const rendered = await Promise.all(
    entries.map(async (e) => {
      // Every entry's body lands in ONE document here, so each gets its own
      // heading-id namespace — otherwise two entries with a "Setup" heading
      // would mint the same anchor. The Ukrainian body of the same entry is a
      // SECOND copy of those headings in that one document, so it takes a
      // namespace of its own on top. See lib/toc.ts.
      const render = async (
        md: string,
        previewMd: string | null,
        idPrefix: string
      ) => {
        const opts = { idPrefix };
        const full = await renderMarkdown(md, e.sectionDir, section.slug, opts);
        const preview = previewMd
          ? await renderMarkdown(previewMd, e.sectionDir, section.slug, opts)
          : null;
        return { full, preview };
      };
      // One cut for the pair, decided on the English body — the same words in
      // Ukrainian run longer, and a per-language budget spent that difference
      // by dropping a whole block from one side. See lib/til-preview.ts.
      const cut = previewBodies(e.content, e.contentUk ?? null);
      return {
        en: await render(e.content, cut.en, `${e.slug}-`),
        // The whole body is translated or it is not — a note without a
        // `.uk.md` sibling keeps showing its English body in either language,
        // the same fallback the entry page makes.
        uk: e.contentUk
          ? await render(e.contentUk, cut.uk, `uk-${e.slug}-`)
          : null,
      };
    })
  );

  return (
    <div className="stagger mt-10 flex flex-col gap-12">
      {entries.map((entry, i) => {
        const href = `/${section.slug}/${entry.slug}`;
        /* Preview plus its "Continue reading" link, per language. The pair
           now cuts at the SAME block, but the link still belongs inside the
           language wrapper rather than beside it: a translation short enough
           to end before that cut is showing everything and has nothing left
           to link to. */
        const body = (doc: { full: string; preview: string | null }): ReactNode =>
          doc.preview ? (
            <>
              <div
                className="prose mt-3"
                dangerouslySetInnerHTML={{ __html: doc.preview }}
              />
              <Link
                href={href}
                className="action-link mt-3 inline-block text-sm font-medium text-[var(--text)] underline decoration-[var(--text-tertiary)] underline-offset-4 hover:decoration-[var(--text)]"
              >
                <T {...ui.continueReading} />
                {/* Its own element so it can lead on hover and be thrown on
                    press — see `.arrow-glyph` in globals.css. */}
                <span className="arrow-glyph" aria-hidden>
                  →
                </span>
              </Link>
            </>
          ) : (
            <div
              className="prose mt-3"
              dangerouslySetInnerHTML={{ __html: doc.full }}
            />
          );

        return (
          <article
            key={entry.slug}
            className="border-b border-[var(--border)] pb-12 last:border-b-0 last:pb-0"
          >
            {entry.date && (
              <time
                dateTime={entry.date}
                className="text-sm text-[var(--text-tertiary)]"
              >
                <T en={displayDate(entry.date)} uk={displayDateUk(entry.date)} />
              </time>
            )}
            <h2 className="mt-1 text-lg font-semibold tracking-tight">
              <Link href={href} className="press text-[var(--text)]">
                <T en={entry.title} uk={entry.titleUk} />
              </Link>
              {/* Outside the link: it labels the entry, it isn't part of the
                  thing you click. Client-only — see components/NewBadge.tsx. */}
              <NewBadge date={entry.date} />
            </h2>
            {rendered[i].uk ? (
              <>
                <div className="lang-en">{body(rendered[i].en)}</div>
                <div className="lang-uk" lang="uk">
                  {body(rendered[i].uk!)}
                </div>
              </>
            ) : (
              body(rendered[i].en)
            )}
          </article>
        );
      })}
    </div>
  );
}

