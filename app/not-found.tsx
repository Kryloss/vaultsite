import Link from "next/link";
import T from "@/components/T";
import NotFoundSuggestions from "@/components/NotFoundSuggestions";
import { ui } from "@/lib/ui-strings";
import Page from "@/components/Page";
import { getSectionBySlug } from "@/lib/vault";

/**
 * 404 — the one page with nothing to read on it.
 *
 * So the number is the page: set at title scale and above, centred in the
 * window, masked out down its own height with the sentence lying across its
 * tail (`.notfound-page`, globals.css). Everything under it is the way out —
 * a sentence, two ways to leave, and the guess at what was actually meant.
 *
 * The second way out is checked against the vault rather than hard-coded:
 * a 404 that links to a section nobody published is a 404 pointing at a 404.
 */
export default function NotFound() {
  const posts = getSectionBySlug("posts");

  return (
    <Page className="notfound-page">
      <div className="notfound-hero stagger">
        <h1 className="notfound-code">404</h1>
        <p className="notfound-lede">
          <T {...ui.notFoundBody} />
        </p>

        <div className="notfound-actions">
          <Link
            href="/"
            className="notfound-btn notfound-btn-primary action-link press"
          >
            {/* Leading, so it points back the way you came — `.is-back` flips
                the spacing and the direction it's thrown in. */}
            <span className="arrow-glyph is-back" aria-hidden>
              ←
            </span>
            <T {...ui.backHome} />
          </Link>

          {posts && (
            <Link
              href={`/${posts.slug}`}
              className="notfound-btn notfound-btn-quiet action-link press"
            >
              <T {...ui.allPosts} />
              <span className="arrow-glyph" aria-hidden>
                →
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* Both the index and the matching land in the browser: a statically
          exported 404 is one file serving every bad URL, so the attempted
          path only exists there. */}
      <NotFoundSuggestions />
    </Page>
  );
}
