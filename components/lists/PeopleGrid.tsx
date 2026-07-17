import Link from "next/link";
import type { ListProps } from "@/lib/section-types";
import { assetUrl } from "@/lib/markdown";

/**
 * "people" section type — app-dissection-style grid of square cover cards.
 *
 * Each entry note can set a cover image via frontmatter:
 *   cover: fedorov.jpg      (a file inside the same section folder)
 * Without a cover, a tile with the person's initials is shown instead.
 */
export default function PeopleGrid({ section, entries }: ListProps) {
  if (entries.length === 0) {
    return (
      <p className="mt-10 text-sm text-[var(--text-tertiary)]">
        Nothing here yet. Add a .md file next to this section&rsquo;s main.md in
        your vault and it will show up automatically.
      </p>
    );
  }

  return (
    <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
      {entries.map((entry) => {
        const cover = cleanCover(entry.meta.cover);
        return (
          <li key={entry.slug}>
            <Link href={`/${section.slug}/${entry.slug}`} className="group block">
              <div className="aspect-square overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-hover)]">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={assetUrl(entry.sectionDir, cover)}
                    alt={entry.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-[var(--text-tertiary)]">
                    {initials(entry.title)}
                  </div>
                )}
              </div>
              <span className="mt-2.5 block font-medium leading-snug text-[var(--text)]">
                {entry.title}
              </span>
              {entry.description && (
                <span className="mt-0.5 block text-sm leading-snug text-[var(--text-secondary)]">
                  {entry.description}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Accepts "photo.jpg", "![[photo.jpg]]" or "[[photo.jpg]]" from frontmatter. */
function cleanCover(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.trim().replace(/^!?\[\[/, "").replace(/\]\]$/, "");
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
