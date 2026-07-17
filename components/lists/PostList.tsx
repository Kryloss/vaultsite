import type { ListProps } from "@/lib/section-types";
import PostListClient, { type PostRow } from "@/components/lists/PostListClient";

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
        Nothing here yet. Add a .md file next to this section&rsquo;s main.md in
        your vault and it will show up automatically.
      </p>
    );
  }

  const rows: PostRow[] = entries.map((entry) => ({
    slug: entry.slug,
    title: entry.title,
    description: entry.description,
    date: entry.date,
    draft: entry.draft,
    category:
      typeof entry.meta.category === "string" ? entry.meta.category : undefined,
  }));

  return <PostListClient sectionSlug={section.slug} rows={rows} />;
}
