import Link from "next/link";
import type { ListProps } from "@/lib/section-types";
import { assetUrl } from "@/lib/markdown";

/**
 * "books" section type — like the people grid, but with vertical 2:3
 * book-cover rectangles. Entry notes are quote-focused (see vault/Books).
 *
 * Entry frontmatter:
 *   cover: sapiens.jpg   (image file inside the same section folder)
 *   author: Yuval Noah Harari
 * Without a cover, a spine-style tile with the title is shown instead.
 */
export default function BookGrid({ section, entries }: ListProps) {
  if (entries.length === 0) {
    return (
      <p className="mt-10 text-sm text-[var(--text-tertiary)]">
        Nothing here yet. Add a .md file next to this section&rsquo;s main.md in
        your vault and it will show up automatically.
      </p>
    );
  }

  return (
    <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3">
      {entries.map((entry) => {
        const cover = cleanCover(entry.meta.cover);
        const author =
          typeof entry.meta.author === "string" ? entry.meta.author : undefined;
        return (
          <li key={entry.slug}>
            <Link href={`/${section.slug}/${entry.slug}`} className="group block">
              <div className="aspect-[2/3] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] shadow-sm transition-shadow duration-300 group-hover:shadow-md">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={assetUrl(entry.sectionDir, cover)}
                    alt={entry.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    loading="lazy"
                  />
                ) : (
                  /* Spine-style fallback cover */
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-3 text-center">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                      {author ?? "—"}
                    </span>
                    <span className="text-sm font-semibold leading-snug text-[var(--text-secondary)]">
                      {entry.title}
                    </span>
                    <span className="h-px w-8 bg-[var(--border)]" />
                  </div>
                )}
              </div>
              <span className="mt-2.5 block font-medium leading-snug text-[var(--text)] group-hover:text-[var(--accent)]">
                {entry.title}
              </span>
              {author && (
                <span className="mt-0.5 block text-sm leading-snug text-[var(--text-secondary)]">
                  {author}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Accepts "cover.jpg", "![[cover.jpg]]" or "[[cover.jpg]]" from frontmatter. */
function cleanCover(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.trim().replace(/^!?\[\[/, "").replace(/\]\]$/, "");
}
