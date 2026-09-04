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
 * Presentational half of the people list: category chips + one card per
 * person. From 640px that is the portrait beside a panel laid over its inner
 * edge carrying the name and the note's one-line description — two cards to a
 * row, scaled to fit the page column rather than widening it. Below 640px it
 * is one full-width portrait with a small name card in its top-right corner.
 * See DECISIONS #125.
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
                    /* The column on a phone; a little under half of half of
                       it in the two-up grid above 640px. */
                    sizes="(max-width: 640px) 90vw, 140px"
                    alt={row.title}
                    /* Full colour at rest. These used to carry
                       `.person-photo`, which held them at `grayscale(0.3)`
                       until the pointer arrived — removed at the owner's
                       request, and with it the people half of DECISIONS #56.
                       The hover scale's easing moved to `.person-card-art img`
                       in globals.css, since the class that carried it is gone. */
                    className={
                      row.contain
                        ? "h-full w-full object-contain p-6"
                        : "h-full w-full object-cover group-hover:scale-105"
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
              </div>

              <div className="person-card-panel">
                <span className="person-card-name">
                  <T en={row.title} uk={row.titleUk} />
                </span>{" "}
                {/* The `chip` shape, not `cover` (#84): on a phone the card
                    takes the corner a cover badge would use, and inside the
                    card the mark really does follow a title in a row of text,
                    which is what that shape is for. Client-only — see
                    NewBadge. */}
                <NewBadge date={row.date} />
                {row.description && (
                  <span className="person-card-role">
                    <T en={row.description} uk={row.descriptionUk} />
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
