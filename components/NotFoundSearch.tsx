"use client";

import T from "@/components/T";
import { ui } from "@/lib/ui-strings";
import { warmSearchIndex } from "@/components/useSearchIndex";
import { SearchIcon } from "@/components/icons";
import { pageIdeas } from "@/lib/site-config";
import { terms } from "@/components/NotFoundSuggestions";

/**
 * The 404's second way out: the search field, in place of a link to a section.
 *
 * A button, not an input, and it says one word. There is exactly one search on
 * this site — the ⌘K palette, with its own index, its own keyboard model and
 * its own results list — and a field here would either be a second, worse one
 * or a box that throws away what you typed the moment the palette opens over
 * it. Pressing this opens that palette, which is where the cursor lands
 * anyway; it is the twin of the Home button beside it — same box, same fill,
 * same width.
 *
 * The palette's open state belongs to components/Chrome.tsx, which is not an
 * ancestor of the page's content, so the request travels as a window event.
 * Chrome listens; the constant is exported from here because this is the only
 * thing that fires it.
 */
export const OPEN_SEARCH_EVENT = "opensearch";

export default function NotFoundSearch() {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(
          /* Page idea `notFoundPrefill` (lib/site-config.ts): the palette
             opens already holding the words of the address that failed, so
             the search starts from what was typed rather than from nothing.
             The palette selects them, so typing replaces them. */
          pageIdeas.notFoundPrefill
            ? new CustomEvent<string>(OPEN_SEARCH_EVENT, {
                detail: terms(window.location.pathname).join(" "),
              })
            : new Event(OPEN_SEARCH_EVENT)
        )
      }
      /* The suggestions below already pull the index on this page, so this is
         usually a no-op — it matters on the 404s that suggest nothing, which
         are exactly the ones where someone reaches for search. */
      onPointerEnter={warmSearchIndex}
      className="notfound-btn notfound-btn-quiet press"
    >
      {/* The ONE icon outside the sidebar (#64), added at the owner's
          request. It is doing the job the arrow does on Home: with two
          identical grey boxes side by side, the mark is what tells them apart
          before the words are read. Decorative — `icons.tsx` sets
          `aria-hidden` on every glyph, and the button says "Search" in both
          languages beside it. */}
      <SearchIcon className="notfound-btn-glyph" />
      <T {...ui.search} />
    </button>
  );
}
