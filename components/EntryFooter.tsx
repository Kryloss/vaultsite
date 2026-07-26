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

      {(prev || next) && (
        <nav className="entry-siblings" aria-label="Neighbouring entries">
          {/* The empty span keeps a lone "next" pushed to the right edge. */}
          {prev ? (
            <Link href={prev.href} className="sibling sibling-prev">
              <span className="sibling-label">
                ← <T {...ui.previousEntry} />
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
              <span className="sibling-label">
                <T {...ui.nextEntry} /> →
              </span>
              <span className="sibling-title">
                <T en={next.title} uk={next.titleUk} />
              </span>
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
