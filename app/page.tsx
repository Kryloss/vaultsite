import Link from "next/link";
import {
  getSections,
  getSectionBySlug,
  getEntries,
  displayDate,
} from "@/lib/vault";
import { renderMarkdown } from "@/lib/markdown";
import { resolveIcon } from "@/components/icons";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";
import { displayDateUk } from "@/lib/vault";

/**
 * Home page — renders vault/Home/main.md, then two generated blocks:
 * the latest posts and an "Explore" grid of all sections. Both are built
 * from the vault at build time, so they never need manual updating.
 */
export default async function HomePage() {
  const home = getSectionBySlug("home");

  if (!home) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20">
        <p className="text-[var(--text-secondary)]">
          Create <code>vault/Home/main.md</code> to populate this page.
        </p>
      </div>
    );
  }

  const html = await renderMarkdown(home.content, home.dirName, home.slug);

  const posts = getSectionBySlug("posts");
  const recent = posts ? getEntries(posts).slice(0, 4) : [];
  const explore = getSections().filter(
    (s) => s.slug !== "home" && s.slug !== "posts" && s.slug !== "now"
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-14 lg:py-24">
      <article className="prose" dangerouslySetInnerHTML={{ __html: html }} />

      {recent.length > 0 && (
        <section className="mt-16">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-[var(--text)]">
              <T {...ui.recentPosts} />
            </h2>
            <Link
              href="/posts"
              className="text-sm text-[var(--text-tertiary)] transition-colors hover:text-[var(--text)]"
            >
              <T {...ui.allPosts} />
            </Link>
          </div>
          <ul className="mt-2 flex flex-col">
            {recent.map((entry) => (
              <li key={entry.slug}>
                <Link
                  href={`/posts/${entry.slug}`}
                  className="-mx-3 flex items-baseline justify-between gap-4 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--bg-hover)]"
                >
                  <span className="truncate font-medium text-[var(--text)]">
                    <T en={entry.title} uk={entry.titleUk} />
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
        <section className="mt-16">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--text)]">
            <T {...ui.explore} />
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {explore.map((section) => {
              const Icon = resolveIcon(section.icon);
              return (
                <Link
                  key={section.slug}
                  href={`/${section.slug}`}
                  className="group rounded-xl border border-[var(--border)] p-4 transition-colors hover:bg-[var(--bg-hover)]"
                >
                  <span className="flex items-center gap-2.5 font-medium text-[var(--text)]">
                    {Icon ? (
                      <Icon className="h-[18px] w-[18px] opacity-75" />
                    ) : section.icon ? (
                      <span className="text-base leading-none">
                        {section.icon}
                      </span>
                    ) : null}
                    <T en={section.title} uk={section.titleUk} />
                  </span>
                  {section.description && (
                    <span className="mt-1.5 line-clamp-2 block text-sm leading-snug text-[var(--text-secondary)]">
                      {section.description}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
