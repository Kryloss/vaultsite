"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";
import { useLang } from "@/components/useLang";
import { useSearchIndex } from "@/components/useSearchIndex";
import { recentPaths } from "@/lib/recents";

const subscribe = () => () => {};
/** Joined into one string so the snapshot compares by value between renders. */
const snapshot = () => recentPaths(window.location.pathname).join("\n");

/**
 * "Where you were" — page idea `notFoundRecents` (lib/site-config.ts,
 * DECISIONS #180). The ⌘K recents (lib/recents.ts), offered on the one page
 * where a reader is most likely to want to go back: a bad link usually
 * interrupts something, and the thing it interrupted is at the top of this
 * list. Titles come from the search index the 404 already fetches for its
 * suggestions, so a path that no longer exists — this very 404 included —
 * simply finds nothing and isn't shown.
 */
export default function NotFoundRecents() {
  const { lang } = useLang();
  const items = useSearchIndex(true);
  const joined = useSyncExternalStore(subscribe, snapshot, () => "");

  const recent = useMemo(() => {
    const byHref = new Map(items.filter((i) => !i.lang).map((i) => [i.href, i]));
    return joined
      .split("\n")
      .map((p) => byHref.get(p))
      .filter((i): i is NonNullable<typeof i> => Boolean(i))
      .slice(0, 4);
  }, [items, joined]);

  if (recent.length === 0) return null;

  return (
    <div className="notfound-suggestions idea-notfound-recents">
      <p className="idea-notfound-recents-label">
        <T {...ui.recentPages} />
      </p>
      <ul className="flex flex-col gap-0.5">
        {recent.map((m) => (
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
