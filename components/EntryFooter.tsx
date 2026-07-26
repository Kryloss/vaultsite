import Link from "next/link";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";
import { categoryLabel } from "@/lib/categories";
import type { EntryRef } from "@/lib/related";

/**
 * The block under an article: notes on the same subject, then the entries
 * either side of this one in the section.
 *
 * Both come from lib/related.ts and render nothing when empty — a lone note
 * in a section, or one with no `categories:`, keeps a clean footer.
 */
export default function EntryFooter({
  related,
  prev,
  next,
}: {
  related: EntryRef[];
  prev?: EntryRef;
  next?: EntryRef;
}) {
  if (related.length === 0 && !prev && !next) return null;

  return (
    <>
      {related.length > 0 && (
        <section className="entry-related">
          <h2 className="entry-footer-title">
            <T {...ui.relatedEntries} />
          </h2>
          <ul>
            {related.map((r) => (
              <li key={r.href}>
                <Link href={r.href} className="related-card">
                  <span className="related-title">
                    <T en={r.title} uk={r.titleUk} />
                  </span>
                  {r.categories && r.categories.length > 0 && (
                    <span className="related-tags">
                      {r.categories.map((c) => (
                        <span key={c}>
                          <T {...categoryLabel(c)} />
                        </span>
                      ))}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* One slim row rather than two stacked cards — the arrows sit at the
          outer edges of the column and the titles fill inward, sharing the
          width and ellipsing when it runs short. */}
      {(prev || next) && (
        <nav className="entry-siblings" aria-label="Neighbouring entries">
          {/* Empty span keeps a lone "next" pinned to the right edge. */}
          {prev ? (
            <Link href={prev.href} className="sibling sibling-prev">
              <span className="sibling-arrow" aria-hidden>
                ‹
              </span>
              {/* The arrow alone has no meaning read aloud. */}
              <span className="sr-only">
                <T {...ui.previousEntry} />
              </span>
              <span className="sibling-title">
                <T en={prev.title} uk={prev.titleUk} />
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={next.href} className="sibling sibling-next">
              <span className="sr-only">
                <T {...ui.nextEntry} />
              </span>
              <span className="sibling-title">
                <T en={next.title} uk={next.titleUk} />
              </span>
              <span className="sibling-arrow" aria-hidden>
                ›
              </span>
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
