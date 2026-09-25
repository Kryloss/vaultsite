import Link from "next/link";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";
import type { EntryRef } from "@/lib/siblings";

/**
 * The block under an article: the entries either side of this one.
 *
 * One slim row rather than stacked cards — the arrows sit at the outer edges
 * of the column and the titles fill inward, sharing the width and ellipsing
 * when it runs short. Renders nothing for a lone note in a section.
 */
export default function EntryFooter({
  prev,
  next,
}: {
  prev?: EntryRef;
  next?: EntryRef;
}) {
  if (!prev && !next) return null;

  return (
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
  );
}
