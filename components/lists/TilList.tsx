import Link from "next/link";
import type { ListProps } from "@/lib/section-types";
import { renderMarkdown } from "@/lib/markdown";
import { displayDate } from "@/lib/vault";

/**
 * "projects" section type — brianlovin.com/til-style feed:
 * every entry's full content is rendered inline on the section page,
 * newest first, with the title linking to the entry's own page.
 *
 * Async server component (it renders markdown at build time).
 */
export default async function TilList({ section, entries }: ListProps) {
  if (entries.length === 0) {
    return (
      <p className="mt-10 text-sm text-[var(--text-tertiary)]">
        Nothing here yet. Add a .md file next to this section&rsquo;s main.md in
        your vault and it will show up automatically.
      </p>
    );
  }

  const rendered = await Promise.all(
    entries.map((e) => renderMarkdown(e.content, e.sectionDir, section.slug))
  );

  return (
    <div className="mt-10 flex flex-col gap-12">
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
              {displayDate(entry.date)}
            </time>
          )}
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            <Link
              href={`/${section.slug}/${entry.slug}`}
              className="text-[var(--text)] transition-colors hover:text-[var(--accent)]"
            >
              {entry.title}
            </Link>
          </h2>
          <div
            className="prose mt-3"
            dangerouslySetInnerHTML={{ __html: rendered[i] }}
          />
        </article>
      ))}
    </div>
  );
}
