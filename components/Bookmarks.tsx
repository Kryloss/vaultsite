"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import T from "@/components/T";
import { BookmarkIcon } from "@/components/icons";
import { useLang } from "@/components/useLang";
import { useSearchIndex } from "@/components/useSearchIndex";
import { ui } from "@/lib/ui-strings";
import {
  bookmarksSnapshot,
  normalise,
  parseSnapshot,
  subscribeBookmarks,
  toggleBookmark,
} from "@/lib/bookmarks";

/** Every bookmarked path, newest first — the same list in every control. */
export function useBookmarks(): string[] {
  const snapshot = useSyncExternalStore(subscribeBookmarks, bookmarksSnapshot, () => "[]");
  return useMemo(() => parseSnapshot(snapshot), [snapshot]);
}

/** Typing into a field is not a shortcut — the rule components/Shortcuts.tsx keeps. */
function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

/**
 * The bookmark control in the breadcrumb chip — page idea `bookmarks`
 * (lib/site-config.ts, DECISIONS #180). A glyph beside the crumbs, filled
 * when this page is kept; `b` does the same from anywhere on the page.
 *
 * Not on Home, whose chip carries no crumbs and is a fixed 44×40 pill (see
 * Chrome.tsx), and not on the 404, which is an address that doesn't exist.
 */
export function BookmarkButton() {
  const pathname = usePathname();
  const { lang } = useLang();
  const list = useBookmarks();
  const here = normalise(pathname);
  const kept = list.includes(here);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "b" || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      if (document.querySelector(".notfound-page")) return;
      e.preventDefault();
      toggleBookmark(here);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [here]);

  const label = kept ? ui.bookmarkRemove : ui.bookmarkAdd;
  return (
    <button
      type="button"
      onClick={() => toggleBookmark(here)}
      aria-pressed={kept}
      aria-label={label[lang]}
      title={`${label[lang]} (b)`}
      className="idea-bookmark press"
    >
      <BookmarkIcon filled={kept} className="h-[17px] w-[17px]" />
    </button>
  );
}

/**
 * The drawer's Bookmarks group, under the sections. Titles come from the
 * search index, fetched only once the drawer is open and there is something
 * to name — a reader with no bookmarks never downloads it for this.
 */
export function DrawerBookmarks({ open }: { open: boolean }) {
  const list = useBookmarks();
  const items = useSearchIndex(open && list.length > 0);
  const { lang } = useLang();
  const pathname = usePathname();

  const pages = useMemo(() => {
    const byHref = new Map(items.filter((i) => !i.lang).map((i) => [i.href, i]));
    return list.map((p) => byHref.get(p)).filter((i): i is NonNullable<typeof i> => Boolean(i));
  }, [items, list]);

  if (pages.length === 0) return null;

  return (
    <div className="idea-drawer-bookmarks">
      <p className="idea-drawer-bookmarks-label">
        <T {...ui.bookmarks} />
      </p>
      <ul>
        {pages.map((p) => (
          <li key={p.href}>
            <Link
              href={p.href}
              className={`idea-drawer-bookmark press${pathname === p.href ? " is-here" : ""}`}
            >
              <span className="idea-drawer-bookmark-title">
                {lang === "uk" && p.titleUk ? p.titleUk : p.title}
              </span>
              <span className="idea-drawer-bookmark-section">
                {lang === "uk" && p.sectionUk ? p.sectionUk : p.section}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
