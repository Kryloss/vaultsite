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
          <SiblingText entry={prev} />
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={next.href} className="sibling sibling-next">
          <span className="sr-only">
            <T {...ui.nextEntry} />
          </span>
          <SiblingText entry={next} />
          <span className="sibling-arrow" aria-hidden>
            ›
          </span>
        </Link>
      )}
    </nav>
  );
}

/**
 * The neighbour's title, and — with page idea `noteNextPreview` on
 * (lib/site-config.ts) — its one-line description under it, so the arrow
 * says what the next read is about and not only what it is called. `lib/siblings.ts`
 * only fills `description` while that switch is on, so with it off this is
 * exactly the title span it replaced.
 */
function SiblingText({ entry }: { entry: EntryRef }) {
  const title = (
    <span className="sibling-title">
      <T en={entry.title} uk={entry.titleUk} />
    </span>
  );
  if (!entry.description) return title;
  return (
    <span className="idea-sibling-text">
      {title}
      <span className="idea-sibling-desc">
        <T en={entry.description} uk={entry.descriptionUk} />
      </span>
    </span>
  );
}
