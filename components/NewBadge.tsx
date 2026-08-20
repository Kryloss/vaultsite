"use client";

import { useEffect, useState } from "react";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";
import { isNew, newSince } from "@/lib/new-notes";

/**
 * "New" beside a list row's title — a note dated after the day you were last
 * here (`lib/new-notes.ts`).
 *
 * Client-only and starts hidden, like every other reader-state badge on the
 * site (`components/Series.tsx` and its read counts): the server has no idea
 * who is reading, so rendering this during SSR would mismatch on hydration.
 * It fills in a frame after mount instead.
 *
 * A component rather than a class on the row, because it has to sit inside
 * `PostRows` — which renders on BOTH sides (it is the Suspense fallback for
 * `PostListClient`). A hook there would make the whole list client-only and
 * empty the static HTML that crawlers and JS-off visitors get.
 *
 * Monochrome, unlike the amber Draft badge next to it: Draft is a warning that
 * only ever appears in `npm run dev`, and the page itself has no accent colour
 * (`docs/DECISIONS.md` #64). Same outline as an inactive filter chip, which is
 * this design's quiet chip — and unlike a filled one it stays legible when the
 * row takes its `--bg-hover` wash.
 */
export default function NewBadge({ date }: { date?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isNew(date, newSince(), Date.now()));
  }, [date]);

  if (!show) return null;

  return (
    <span className="ml-2 rounded border border-[var(--border)] px-1.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
      <T {...ui.newBadge} />
    </span>
  );
}
