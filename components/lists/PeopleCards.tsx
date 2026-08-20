import Link from "next/link";
import T from "@/components/T";
import NewBadge from "@/components/NewBadge";
import { ui } from "@/lib/ui-strings";
import { categoryLabel } from "@/lib/categories";

export interface PersonRow {
  slug: string;
  title: string;
  titleUk?: string;
  description?: string;
  cover?: string;
  /** Base64 blur-up placeholder for `cover` — see lib/blur.ts. */
  coverBlur?: string;
  coverSrcSet?: string;
  contain?: boolean;
  /** From `categories:` or `category:` frontmatter. */
  categories: string[];
  /** `date:` frontmatter — read by components/NewBadge.tsx. */
  date?: string;
}

/**
 * Presentational half of the people list: category chips + the cover grid.
 * No hooks, so it renders the same on the server (as the Suspense fallback in
 * PeopleGrid) and inside the client component that reads the active category
 * from the URL. Mirrors PostRows.
 */
export default function PeopleCards({
  sectionSlug,
  rows,
  categories,
  active,
}: {
  sectionSlug: string;
  rows: PersonRow[];
  categories: string[];
  /** null = "All" */
  active: string | null;
}) {
  const filtered = active
    ? rows.filter((r) => r.categories.includes(active))
    : rows;

  const chip = (key: string, label: React.ReactNode, value: string | null) => (
    <Link
      key={key}
      href={
        value
          ? `/${sectionSlug}?category=${encodeURIComponent(value)}`
          : `/${sectionSlug}`
      }
      scroll={false}
      className={`press rounded-full border px-3 py-1 text-sm ${
        active === value
          ? "border-[var(--text)] bg-[var(--text)] font-medium text-[var(--bg)]"
          : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)] hover:text-[var(--text)]"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div>
      {categories.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {chip("__all", <T {...ui.filterAll} />, null)}
          {categories.map((c) => chip(c, <T {...categoryLabel(c)} />, c))}
        </div>
      )}

      <ul className="stagger mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
        {filtered.map((row) => (
          <li key={row.slug}>
            <Link
              href={`/${sectionSlug}/${row.slug}`}
              className="group press press-soft block"
            >
              <div className="people-cover relative aspect-square overflow-hidden rounded-2xl bg-[var(--surface)]">
                {row.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.cover}
                    srcSet={row.coverSrcSet}
                    /* Two per row on a phone, three in the grid above it. */
                    sizes="(max-width: 640px) 50vw, 220px"
                    alt={row.title}
                    /* `person-photo` (globals.css) holds the photographs at
                       partial saturation and returns them to full colour on
                       hover — the one place on a monochrome site where colour
                       is allowed, and only when it's asked for. It also owns
                       the transition, so the utility class here doesn't
                       declare one and overwrite the filter half of it. */
                    className={
                      row.contain
                        ? "person-photo h-full w-full object-contain p-6"
                        : "person-photo h-full w-full object-cover group-hover:scale-105"
                    }
                    // Blur-up placeholder as the image's own background — see
                    // the matching note in ShelfCard.tsx and lib/blur.ts.
                    style={
                      row.coverBlur
                        ? {
                            backgroundImage: `url("${row.coverBlur}")`,
                            backgroundSize: row.contain ? "contain" : "cover",
                            backgroundPosition: "center",
                            backgroundRepeat: "no-repeat",
                          }
                        : undefined
                    }
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-[var(--text-tertiary)]">
                    {initials(row.title)}
                  </div>
                )}
                {/* Client-only — see components/NewBadge.tsx. */}
                <NewBadge date={row.date} variant="cover" />
              </div>
              <span className="mt-2.5 block truncate font-medium leading-snug text-[var(--text)]">
                <T en={row.title} uk={row.titleUk} />
              </span>
              {row.description && (
                <span className="mt-0.5 block truncate text-sm leading-snug text-[var(--text-secondary)]">
                  {row.description}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <p className="mt-10 text-sm text-[var(--text-tertiary)]">
          <T {...ui.nothingInCategory} />
        </p>
      )}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
