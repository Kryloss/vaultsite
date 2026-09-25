"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import PostRows from "@/components/lists/PostRows";

export interface PostRow {
  slug: string;
  title: string;
  titleUk?: string;
  description?: string;
  descriptionUk?: string;
  date?: string;
  draft: boolean;
  category?: string;
}

/**
 * Client half of the posts list: reads the active category from `?category=`
 * and hands it to PostRows. No local state — the URL is the source of truth,
 * so a link from a post's own category chip lands here already filtered.
 *
 * `useSearchParams()` rather than reading `window.location` in an effect: on an
 * App Router transition the URL isn't necessarily committed when an effect
 * fires, which silently broke the same feature on the shelf (see DECISIONS #13).
 * The hook is reactive and always correct.
 *
 * The cost is that this subtree renders on the client. PostList wraps it in a
 * Suspense boundary whose fallback is the same list unfiltered, so the static
 * HTML still contains every post for crawlers and for JS-off visitors.
 */
export default function PostListClient({
  sectionSlug,
  rows,
}: {
  sectionSlug: string;
  rows: PostRow[];
}) {
  const params = useSearchParams();

  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const row of rows) {
      if (row.category && !seen.includes(row.category)) seen.push(row.category);
    }
    return seen;
  }, [rows]);

  const wanted = params.get("category");
  const active = wanted && categories.includes(wanted) ? wanted : null;

  return (
    <PostRows
      sectionSlug={sectionSlug}
      rows={rows}
      categories={categories}
      active={active}
    />
  );
}
