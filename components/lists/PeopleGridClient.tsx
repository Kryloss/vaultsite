"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import PeopleCards, { type PersonRow } from "@/components/lists/PeopleCards";

/**
 * Client half of the people list: reads the active category from `?category=`
 * and hands it to PeopleCards. Same shape as PostListClient — no local state,
 * the URL is the source of truth, so a person's own category chip lands here
 * already filtered.
 */
export default function PeopleGridClient({
  sectionSlug,
  rows,
}: {
  sectionSlug: string;
  rows: PersonRow[];
}) {
  const params = useSearchParams();

  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const row of rows)
      for (const c of row.categories) if (!seen.includes(c)) seen.push(c);
    return seen;
  }, [rows]);

  const wanted = params.get("category");
  const active = wanted && categories.includes(wanted) ? wanted : null;

  return (
    <PeopleCards
      sectionSlug={sectionSlug}
      rows={rows}
      categories={categories}
      active={active}
    />
  );
}
