"use client";

import { useEffect, useState } from "react";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";
import { isNew, newSince } from "@/lib/new-notes";

/**
 * "New" on an entry that arrived after your last visit (`lib/new-notes.ts`).
 *
 * Client-only and starts hidden, like every other reader-state signal on the
 * site (`components/Series.tsx` and its read counts): the server has no idea
 * who is reading, so rendering this during SSR would mismatch on hydration.
 * It fills in a frame after mount instead.
 *
 * A component rather than a hook, because it has to sit inside components that
 * render on BOTH sides — `PostRows` and `PeopleCards` are the Suspense
 * fallbacks for their own client halves. A hook there would make the whole
 * list client-only and empty the static HTML that crawlers and JS-off visitors
 * get.
 *
 * Two shapes, because the site lists things two ways:
 *
 * - `chip` (default) follows a title in a row of text — posts, projects,
 *   music. Monochrome, unlike the amber Draft chip it sits beside: Draft only
 *   appears in `npm run dev`, and the published page has no accent colour
 *   (`docs/DECISIONS.md` #64). It takes the outline of an inactive filter
 *   chip, which is this design's quiet chip, and unlike a filled one it stays
 *   legible when the row takes its `--bg-hover` wash.
 *
 * - `cover` is for a card whose subject is artwork — shelf and people. There
 *   is no room after a title there and no predictable colour underneath, so it
 *   becomes a mark ON the cover in the same material as the shelf's "Reading"
 *   badge (`.shelf-status`), in the opposite corner so a card can carry both.
 *
 * - `dot` is for a book spine, which is 44px wide: neither of the above fits,
 *   and a word turned on its side beside a title turned on its side is
 *   unreadable. It becomes a mark at the head of the spine, in the spine's own
 *   `--spine-fg` so it works against whatever colour the cover supplied. The
 *   word itself stays as `sr-only` text, so nothing is lost to anyone who
 *   can't see a dot.
 */
export default function NewBadge({
  date,
  variant = "chip",
}: {
  date?: string;
  variant?: "chip" | "cover" | "dot";
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isNew(date, newSince(), Date.now()));
  }, [date]);

  if (!show) return null;

  if (variant === "dot")
    return (
      <span className="spine-new">
        <span className="sr-only">
          <T {...ui.newBadge} />
        </span>
      </span>
    );

  return (
    <span
      className={
        variant === "cover"
          ? "cover-new"
          : "ml-2 rounded border border-[var(--border)] px-1.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]"
      }
    >
      <T {...ui.newBadge} />
    </span>
  );
}
