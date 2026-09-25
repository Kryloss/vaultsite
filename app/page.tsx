import type { Metadata } from "next";
import Link from "next/link";
import {
  getSections,
  getSectionBySlug,
  getEntries,
  displayDate,
} from "@/lib/vault";
import { renderMarkdown } from "@/lib/markdown";
import T from "@/components/T";
import SocialLinks from "@/components/SocialLinks";
import NewBadge from "@/components/NewBadge";
import { ui } from "@/lib/ui-strings";
import { displayDateUk } from "@/lib/vault";
import { pageMeta } from "@/lib/metadata";
import { previewsInHtml } from "@/lib/previews";
import LinkPreview from "@/components/LinkPreview";
import Page from "@/components/Page";
import Intro from "@/components/Intro";

/** Title and description come from the layout's defaults; this adds the
    canonical, which every page needs and the root most of all. */
export const metadata: Metadata = pageMeta({ path: "/" });

/**
 * Home page — renders vault/Home/main.md, then two generated blocks:
 * the latest posts and an "Explore" grid of all sections. Both are built
 * from the vault at build time, so they never need manual updating.
 */
export default async function HomePage() {
  const home = getSectionBySlug("home");

  if (!home) {
    return (
      <Page>
        <p className="text-[var(--text-secondary)]">
          Create <code>vault/Home/main.md</code> to populate this page.
        </p>
      </Page>
    );
  }

  const html = await renderMarkdown(home.content, home.dirName, home.slug, {
    anchorLabel: ui.headingAnchor.en,
  });
  // Ukrainian body shares this document — its heading ids get their own
  // namespace so anchors can't collide. See lib/toc.ts.
  const htmlUk = home.contentUk
    ? await renderMarkdown(home.contentUk, home.dirName, home.slug, {
        idPrefix: "uk-",
        anchorLabel: ui.headingAnchor.uk,
      })
    : null;

  const posts = getSectionBySlug("posts");
  const recent = posts ? getEntries(posts).slice(0, 4) : [];
  const explore = getSections().filter(
    (s) => s.slug !== "home" && s.slug !== "posts" && s.slug !== "now"
  );

  return (
    <Page
      data-dev-vault-source={`vault/${home.dirName}/main.md`}
      data-dev-vault-source-uk={
        home.contentUk !== undefined ? `vault/${home.dirName}/main.uk.md` : undefined
      }
    >
      <LinkPreview previews={previewsInHtml(html, htmlUk)} />
      {/* Renders nothing. Types the heading below on a reader's first ever
          visit; the pre-paint half of it lives in app/layout.tsx. */}
      <Intro />
      {htmlUk ? (
        <>
          <article
            className="prose lang-en"
            data-dev-body-field="body"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <article
            className="prose lang-uk"
            lang="uk"
            data-dev-body-field="body_uk"
            dangerouslySetInnerHTML={{ __html: htmlUk }}
          />
        </>
      ) : (
        <article
          className="prose"
          data-dev-body-field="body"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}

      <SocialLinks className="mt-8" />

      {recent.length > 0 && (
        <section className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-[var(--text)]">
              <T {...ui.recentPosts} />
            </h2>
            <Link
              href="/posts"
              className="action-link press text-sm text-[var(--text-tertiary)] hover:text-[var(--text)]"
            >
              <T {...ui.allPosts} />
              <span className="arrow-glyph" aria-hidden>
                →
              </span>
            </Link>
          </div>
          <ul className="mt-2 flex flex-col">
            {recent.map((entry) => (
              <li key={entry.slug}>
                <Link
                  href={`/posts/${entry.slug}`}
                  className="press press-soft -mx-3 flex items-baseline justify-between gap-4 rounded-lg px-3 py-2 hover:bg-[var(--bg-hover)]"
                >
                  <span className="truncate font-medium text-[var(--text)]">
                    <T en={entry.title} uk={entry.titleUk} />
                    {/* Client-only — see components/NewBadge.tsx. */}
                    <NewBadge date={entry.date} />
                  </span>
                  {entry.date && (
                    <time
                      dateTime={entry.date}
                      className="shrink-0 text-sm tabular-nums text-[var(--text-tertiary)]"
                    >
                      <T
                        en={displayDate(entry.date)}
                        uk={displayDateUk(entry.date)}
                      />
                    </time>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {explore.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--text)]">
            <T {...ui.explore} />
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {explore.map((section) => {
              return (
                <Link
                  key={section.slug}
                  href={`/${section.slug}`}
                  className="group press press-soft rounded-xl border border-[var(--border)] p-4 hover:bg-[var(--bg-hover)]"
                >
                  {/* No icon. The section emoji belongs to the sidebar, where
                      it's a target you aim at in a list you've learned; here
                      it's decoration on a card that already says the name in
                      words. */}
                  <span className="block font-medium text-[var(--text)]">
                    <T en={section.title} uk={section.titleUk} />
                  </span>
                  {section.description && (
                    <span className="mt-1.5 line-clamp-2 block text-sm leading-snug text-[var(--text-secondary)]">
                      <T en={section.description} uk={section.descriptionUk} />
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </Page>
  );
}
