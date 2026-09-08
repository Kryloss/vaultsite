import Link from "next/link";
import T from "@/components/T";
import NotFoundSuggestions from "@/components/NotFoundSuggestions";
import { ui } from "@/lib/ui-strings";
import Page from "@/components/Page";
import NotFoundSearch from "@/components/NotFoundSearch";

/**
 * 404 — the one page with nothing to read on it.
 *
 * So the number IS the page, and by now it is nearly all of it: set at title
 * scale and above, centred in the window, masked out down its own height
 * (`.notfound-page`, globals.css). No sentence — "404" under a breadcrumb
 * that already names where you are says what happened. Under it, the two ways
 * out and the guess at what was actually meant.
 *
 * Two words, matched: Home and Search. The second is a link no longer — on
 * the page you land on when the URL was wrong, the useful control is the one
 * that finds the right page, not another list to browse.
 */
export default function NotFound() {
  return (
    <Page className="notfound-page">
      <div className="notfound-hero stagger">
        <h1 className="notfound-code">404</h1>

        <div className="notfound-actions">
          <Link
            href="/"
            className="notfound-btn notfound-btn-quiet action-link press"
          >
            {/* Leading, so it points back the way you came — `.is-back` flips
                the spacing and the direction it's thrown in. */}
            <span className="arrow-glyph is-back" aria-hidden>
              ←
            </span>
            <T {...ui.home} />
          </Link>

          <NotFoundSearch />
        </div>
      </div>

      {/* Both the index and the matching land in the browser: a statically
          exported 404 is one file serving every bad URL, so the attempted
          path only exists there. */}
      <NotFoundSuggestions />
    </Page>
  );
}
