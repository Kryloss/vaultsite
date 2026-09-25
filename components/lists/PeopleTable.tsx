"use client";

import { useState } from "react";
import Link from "next/link";
import T from "@/components/T";
import NewBadge from "@/components/NewBadge";
import { ui } from "@/lib/ui-strings";
import { categoryLabel } from "@/lib/categories";
import { yearOf } from "@/lib/people-table";
import type { PersonRow } from "@/components/lists/PeopleCards";

type SortKey = "list" | "name" | "born";

/**
 * The People page as a database table — page idea `peopleTable`
 * (lib/site-config.ts, DECISIONS #180). The home page calls this site "a
 * database of my own life"; this is the view that takes it at its word, the
 * way Obsidian Bases and Notion put a Table beside a Gallery.
 *
 * Columns come from each note's own "At a glance" table (lib/people-table.ts).
 * Person and Born sort on a press — a second press reverses, a third returns
 * to the page's own order — and the header says which, through `aria-sort`.
 * Sorting is local state: it is a way of reading, not a place to link to.
 */
export default function PeopleTable({
  sectionSlug,
  rows,
}: {
  sectionSlug: string;
  rows: PersonRow[];
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "list", dir: 1 });

  const sorted =
    sort.key === "list"
      ? rows
      : [...rows].sort((a, b) => {
          if (sort.key === "name") return a.title.localeCompare(b.title) * sort.dir;
          const ya = yearOf(a.facts?.born?.en) ?? Infinity;
          const yb = yearOf(b.facts?.born?.en) ?? Infinity;
          return (ya - yb) * sort.dir;
        });

  const press = (key: SortKey) =>
    setSort((s) =>
      s.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : { key: "list", dir: 1 }
    );
  const ariaSort = (key: SortKey) =>
    sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : undefined;
  const arrow = (key: SortKey) =>
    sort.key === key ? (sort.dir === 1 ? "↑" : "↓") : "";

  const empty = <span className="idea-ptable-empty">—</span>;

  return (
    <div className="idea-ptable-wrap stagger">
      <table className="idea-ptable">
        <thead>
          <tr>
            <th scope="col" aria-sort={ariaSort("name")}>
              <button type="button" className="idea-ptable-sort press" onClick={() => press("name")}>
                <T {...ui.colPerson} />
                <span className="idea-ptable-arrow" aria-hidden>{arrow("name")}</span>
              </button>
            </th>
            <th scope="col" aria-sort={ariaSort("born")}>
              <button type="button" className="idea-ptable-sort press" onClick={() => press("born")}>
                <T {...ui.colBorn} />
                <span className="idea-ptable-arrow" aria-hidden>{arrow("born")}</span>
              </button>
            </th>
            <th scope="col">
              <T {...ui.colKnownFor} />
            </th>
            <th scope="col" className="idea-ptable-cat">
              <T {...ui.colCategory} />
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.slug}>
              <th scope="row">
                <Link href={`/${sectionSlug}/${row.slug}`} className="idea-ptable-person">
                  {row.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.cover}
                      srcSet={row.coverSrcSet}
                      sizes="32px"
                      alt=""
                      className="idea-ptable-face"
                      loading="lazy"
                    />
                  ) : (
                    <span className="idea-ptable-face" aria-hidden />
                  )}
                  <span className="idea-ptable-name">
                    <T en={row.title} uk={row.titleUk} />
                    <NewBadge date={row.date} />
                  </span>
                </Link>
              </th>
              <td>{row.facts?.born ? <T {...row.facts.born} /> : empty}</td>
              <td>
                {row.facts?.knownFor ? (
                  <T {...row.facts.knownFor} />
                ) : row.description ? (
                  <T en={row.description} uk={row.descriptionUk} />
                ) : (
                  empty
                )}
              </td>
              <td className="idea-ptable-cat">
                {row.categories.length > 0
                  ? row.categories.map((c, i) => (
                      <span key={c}>
                        {i > 0 && ", "}
                        <T {...categoryLabel(c)} />
                      </span>
                    ))
                  : empty}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
