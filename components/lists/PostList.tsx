import { Suspense } from "react";
import type { ListProps } from "@/lib/section-types";
import PostListClient, { type PostRow } from "@/components/lists/PostListClient";
import PostRows from "@/components/lists/PostRows";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";

/**
 * Default "posts" list (server side): slims entries down to serializable rows
 * and hands them to the client component, which renders category filter chips
 * and the year-grouped list. Categories come from entry frontmatter:
 *
 *   category: Cybersecurity
 */
export default function PostList({ section, entries }: ListProps) {
  if (entries.length === 0) {
    return (
      <p className="mt-10 text-sm text-[var(--text-tertiary)]">
        <T {...ui.emptyState} />
      </p>
    );
  }

  const rows: PostRow[] = entries.map((entry) => ({
    slug: entry.slug,
    title: entry.title,
    titleUk: entry.titleUk,
    description: entry.description,
    date: entry.date,
    draft: entry.draft,
    category:
      typeof entry.meta.category === "string" ? entry.meta.category : undefined,
  }));

  const categories: string[] = [];
  for (const row of rows) {
    if (row.category && !categories.includes(row.category))
      categories.push(row.category);
  }

  // The client half reads `?category=` via useSearchParams(), which Next
  // requires behind a Suspense boundary and renders on the client. The fallback
  // is the same list unfiltered, so the static HTML still holds every post —
  // without it the page would ship empty to crawlers and JS-off visitors.
  return (
    <Suspense
      fallback={
        <PostRows
          sectionSlug={section.slug}
          rows={rows}
          categories={categories}
          active={null}
        />
      }
    >
      <PostListClient sectionSlug={section.slug} rows={rows} />
    </Suspense>
  );
}
