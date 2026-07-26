"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import T from "@/components/T";
import { useLang } from "@/components/useLang";
import { ui } from "@/lib/ui-strings";
import type { SearchItem } from "@/lib/vault";

/**
 * "Did you mean…" for a mistyped URL.
 *
 * The path is only knowable in the browser — a statically-exported 404 is one
 * file serving every bad URL — so the matching runs client-side against the
 * same build-time index the Cmd+K palette uses. No extra payload: the index is
 * already in the page.
 */

/** Words too common to say anything about which note was meant. */
const STOPWORDS = new Set(["the", "a", "an", "of", "and", "my", "to", "in"]);

/** "/posts/my-frist-certifcation" → ["frist", "certifcation"] */
function terms(pathname: string): string[] {
  return pathname
    .split("/")
    .filter(Boolean)
    .flatMap((seg) => decodeURIComponent(seg).split("-"))
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Overlap of character trigrams — catches transpositions and dropped letters
 * ("certifcation" → "certification") that a substring match misses entirely,
 * without pulling in a fuzzy-search dependency.
 */
function trigrams(s: string): Set<string> {
  const padded = ` ${s.toLowerCase().replace(/[^a-z0-9Ѐ-ӿ]+/g, " ")} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

function similarity(a: string, b: string): number {
  const A = trigrams(a);
  const B = trigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const g of A) if (B.has(g)) shared++;
  return shared / Math.max(A.size, B.size);
}

export default function NotFoundSuggestions({ items }: { items: SearchItem[] }) {
  const { lang } = useLang();
  const [matches, setMatches] = useState<SearchItem[]>([]);

  useEffect(() => {
    const path = window.location.pathname;
    const words = terms(path);
    if (words.length === 0) return;
    const query = words.join(" ");

    const scored = items
      // Headings would suggest a fragment of a page rather than the page.
      .filter((i) => !i.lang)
      .map((item) => {
        const title = similarity(query, item.title);
        const titleUk = item.titleUk ? similarity(query, item.titleUk) : 0;
        // A slug word appearing verbatim in the URL is a strong signal that
        // trigram overlap alone would underweight on long titles.
        const exact = words.some((w) => item.href.includes(w)) ? 0.25 : 0;
        return { item, score: Math.max(title, titleUk) + exact };
      })
      .filter((r) => r.score > 0.18)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    setMatches(scored.map((r) => r.item));
  }, [items]);

  if (matches.length === 0) return null;

  return (
    <div className="mt-8">
      <p className="text-sm text-[var(--text-tertiary)]">
        <T {...ui.didYouMean} />
      </p>
      <ul className="mt-3 flex flex-col gap-0.5">
        {matches.map((m) => (
          <li key={m.href}>
            <Link href={m.href} className="backlink-ish">
              <span className="text-[0.9375rem] text-[var(--text)]">
                {lang === "uk" && m.titleUk ? m.titleUk : m.title}
              </span>
              <span className="shrink-0 text-xs text-[var(--text-tertiary)]">
                {lang === "uk" && m.sectionUk ? m.sectionUk : m.section}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
