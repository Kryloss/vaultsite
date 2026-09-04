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
  descriptionUk?: string;
  /** Opening of the note's first prose paragraph — see lib/people.ts. */
  blurb?: string;
  blurbUk?: string;
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
 * Presentational half of the people list: category chips + one wide card per
 * person — the portrait at full size with a panel offset over its inner edge,
 * carrying the name, the one-line description and the opening of the note.
 * One card per row at every width; below 640px the panel drops under the
 * portrait and the offset goes with it. See DECISIONS #125.
 *
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

      <ul className="stagger person-cards mt-8">
        {filtered.map((row) => (
          <li key={row.slug}>
            <Link
              href={`/${sectionSlug}/${row.slug}`}
              className="group press press-soft person-card"
            >
              <div className="people-cover person-card-art">
                {row.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.cover}
                    srcSet={row.coverSrcSet}
                    /* Full width of the column on a phone, a little under half
                       of it in the card's row above 640px. */
                    sizes="(max-width: 640px) 82vw, 300px"
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

              <div className="person-card-panel">
                <span className="person-card-name">
                  <T en={row.title} uk={row.titleUk} />
                </span>
                {row.description && (
                  <span className="person-card-role">
                    <T en={row.description} uk={row.descriptionUk} />
                  </span>
                )}
                {row.blurb && (
                  <span className="person-card-blurb">
                    <T en={row.blurb} uk={row.blurbUk} />
                  </span>
                )}
              </div>
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
