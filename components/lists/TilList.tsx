import Link from "next/link";
import type { ListProps } from "@/lib/section-types";
import { renderMarkdown } from "@/lib/markdown";
import { displayDate, displayDateUk } from "@/lib/vault";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";

/** Entries longer than this (raw markdown chars) get truncated with an expand toggle. */
const PREVIEW_LIMIT = 1000;

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
      // would mint the same anchor. See lib/toc.ts.
      const opts = { idPrefix: `${e.slug}-` };
      const full = await renderMarkdown(e.content, e.sectionDir, section.slug, opts);
      const previewMd = truncateMarkdown(e.content, PREVIEW_LIMIT);
      const preview = previewMd
        ? await renderMarkdown(previewMd, e.sectionDir, section.slug, opts)
        : null;
      return { full, preview };
    })
  );

  return (
    <div className="stagger mt-10 flex flex-col gap-12">
      {entries.map((entry, i) => (
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
            <Link
              href={`/${section.slug}/${entry.slug}`}
              className="press text-[var(--text)]"
            >
              <T en={entry.title} uk={entry.titleUk} />
            </Link>
          </h2>
          {rendered[i].preview ? (
            <>
              <div
                className="prose mt-3"
                dangerouslySetInnerHTML={{ __html: rendered[i].preview }}
              />
              <Link
                href={`/${section.slug}/${entry.slug}`}
                className="mt-3 inline-block text-sm font-medium text-[var(--text)] underline decoration-[var(--text-tertiary)] underline-offset-4 hover:decoration-[var(--text)]"
              >
                <T {...ui.continueReading} />
              </Link>
            </>
          ) : (
            <div
              className="prose mt-3"
              dangerouslySetInnerHTML={{ __html: rendered[i].full }}
            />
          )}
        </article>
      ))}
    </div>
  );
}

/**
 * Cuts markdown at the last paragraph boundary under `limit` characters.
 * Returns null when no truncation is needed. If the very first paragraph
 * already exceeds the limit, it is hard-cut at a word boundary.
 */
function truncateMarkdown(md: string, limit: number): string | null {
  const trimmed = md.trim();
  if (trimmed.length <= limit) return null;

  const blocks = trimmed.split(/\n\s*\n/);
  const out: string[] = [];
  let length = 0;

  for (const block of blocks) {
    if (out.length === 0 && block.length > limit) {
      return block.slice(0, limit).replace(/\s+\S*$/, "") + "…";
    }
    if (length + block.length > limit) break;
    out.push(block);
    length += block.length;
  }

  const preview = out.join("\n\n");
  return preview.length >= trimmed.length ? null : preview;
}
