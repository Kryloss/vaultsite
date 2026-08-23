"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { repoBranch, repoUrl } from "@/lib/site-config";
import T from "@/components/T";
import { useLang } from "@/components/useLang";
import { useSearchIndex } from "@/components/useSearchIndex";
import { recentPaths, remember } from "@/lib/recents";
import { similarity, fold } from "@/lib/fuzzy";
import { copyText } from "@/lib/clipboard";
import { shortcutKey } from "@/lib/shortcut-key";
import { SHORTCUTS_EVENT } from "@/components/Shortcuts";
import { ui, type Str } from "@/lib/ui-strings";

/**
 * Cmd/Ctrl+K palette over the static, build-time index of every page.
 * No backend — the index is one static JSON file, fetched the first time the
 * palette opens (see app/search-index.json/route.ts).
 * Opened by hotkey (handled in Chrome) or the search button.
 *
 * It finds pages AND runs commands. The actions live in the same list as the
 * results and are matched by the same query, so there's one box to learn
 * rather than a search box plus a scattering of buttons that only exist on
 * some pages. They sort below page matches: typing a note's name must always
 * open the note.
 *
 * Every action is something the site can already do without a server — switch
 * language, copy the page's vault source, copy a link, jump somewhere random.
 * An action that needed a backend wouldn't belong here.
 */

/**
 * The vault file behind the page, in the language being read — written onto
 * the entry page's wrapper as a data attribute. A note without a translation
 * falls back to the English source rather than offering a link to nothing.
 */
function sourcePath(lang: "en" | "uk"): string | undefined {
  if (typeof document === "undefined") return undefined;
  const el = document.querySelector<HTMLElement>("[data-vault-source]");
  if (!el) return undefined;
  return (
    (lang === "uk" ? el.dataset.vaultSourceUk : undefined) ??
    el.dataset.vaultSource
  );
}

interface Action {
  id: string;
  label: Str;
  /** Return true to keep the palette open (e.g. to show a "Done" flash). */
  run: () => void | Promise<void>;
  /** Hidden when false — "copy this page" makes no sense on a section list. */
  when?: () => boolean;
}
export default function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  /** Brief "Done" in the footer after a copy, so it isn't silent. */
  const [flash, setFlash] = useState(false);
  /**
   * The shell stays mounted so it can animate shut, but its contents wait for
   * the first open. Rendering the default eight results into the static HTML
   * of every page cost ~11 KB each, for markup nobody sees until they press
   * ⌘K — and once they have, it stays for the exit animation.
   */
  const [everOpen, setEverOpen] = useState(false);
  useEffect(() => {
    if (open) setEverOpen(true);
  }, [open]);
  /* The index is fetched on that same first open — nobody who never searches
     downloads it, and nobody who does waits twice. */
  const items = useSearchIndex(everOpen);
  const { lang, toggle: toggleLang } = useLang();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  const router = useRouter();
  const pathname = usePathname();

  /* Recorded here because the palette is the only thing that reads recents and
     is mounted on every page anyway (via components/Chrome.tsx). */
  useEffect(() => remember(pathname), [pathname]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setFlash(false);
      // Focus after the element mounts
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  /**
   * A leading `>` scopes the search to the page you're on — its own entry plus
   * every heading in it. A long note is the one place where the global index
   * is the wrong index: you know which note you're in, you just can't find the
   * section. `>` alone (no query) lists the note's outline.
   *
   * The prefix rather than scoping automatically on a long page: an implicit
   * mode that silently hides most of your results is worse than one keystroke.
   */
  const scoped = query.startsWith(">");

  const { results, fuzzy, recent } = useMemo(() => {
    // Heading results exist once per language (each has its own anchor); show
    // only the active one. Page results carry no `lang` and always show.
    let pool = items.filter((i) => !i.lang || i.lang === lang);
    if (scoped) {
      const here = pathname.replace(/\/$/, "") || "/";
      pool = pool.filter((i) => (i.href.split("#")[0].replace(/\/$/, "") || "/") === here);
    }
    // Accent-stripped so "resume" matches "Résumé" — see lib/fuzzy.ts → fold().
    const q = fold((scoped ? query.slice(1) : query).trim());
    // With no query, lead with pages rather than a wall of headings — except
    // when scoped, where the headings ARE the answer: `>` on its own prints
    // the note's outline.
    if (!q) {
      // Scoped (`>` alone) means "the outline of this page" — recents would be
      // answering a different question.
      if (scoped) return { results: pool.slice(0, 8), fuzzy: false, recent: 0 };

      const pages = pool.filter((i) => !i.lang);
      const byHref = new Map(pages.map((p) => [p.href, p]));
      // Where you've been, then the rest of the site to fill the panel — the
      // empty palette used to show the same eight pages to everyone.
      const recents = recentPaths(pathname)
        .map((href) => byHref.get(href))
        .filter((p): p is (typeof pages)[number] => p !== undefined)
        .slice(0, 5);
      const seen = new Set(recents.map((p) => p.href));
      const rest = pages.filter((p) => !seen.has(p.href));
      return {
        results: [...recents, ...rest].slice(0, 8),
        fuzzy: false,
        recent: recents.length,
      };
    }
    const scored = pool
      .map((item) => {
        // Match against both language titles + the folded-in text so a query
        // in either English or Ukrainian finds the page.
        const titles = [item.title, item.titleUk ?? ""].map(fold);
        const sections = [item.section, item.sectionUk ?? ""].map(fold);
        let score = 0;
        if (titles.some((t) => t.startsWith(q))) score = 4;
        else if (titles.some((t) => t.includes(q))) score = 3;
        else if (sections.some((s) => s.includes(q))) score = 2;
        else if (fold(item.text).includes(q)) score = 1;
        // A page outranks one of its own headings at equal strength, so
        // searching a post's name still opens the post first.
        if (score > 0 && item.lang) score -= 0.5;
        return { item, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      return { results: scored.slice(0, 8).map((r) => r.item), fuzzy: false, recent: 0 };
    }

    // Nothing matched literally — most often a typo. Fall back to trigram
    // similarity against titles so "certifcation" still finds the post, and
    // label the results so they don't read as exact matches.
    const near = pool
      .filter((i) => !i.lang)
      .map((item) => ({
        item,
        score: Math.max(
          similarity(q, item.title),
          item.titleUk ? similarity(q, item.titleUk) : 0
        ),
      }))
      .filter((r) => r.score > 0.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return { results: near.map((r) => r.item), fuzzy: near.length > 0, recent: 0 };
  }, [query, items, lang, scoped, pathname]);

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

  /**
   * Runnable commands. `when` hides the ones that need a page-specific control
   * to exist — "copy as Markdown" clicks the button beside an entry's title
   * (components/CopyMarkdown.tsx) rather than duplicating the note's source
   * into this component, which would put the same text in the page twice.
   */
  const actions = useMemo<Action[]>(
    () => [
      {
        id: "lang",
        label: ui.actionToggleLang,
        run: () => {
          toggleLang();
          onClose();
        },
      },
      {
        id: "copy-md",
        label: ui.actionCopyMarkdown,
        when: () => !!document.querySelector("button.copy-md"),
        run: () => {
          document.querySelector<HTMLButtonElement>("button.copy-md")?.click();
        },
      },
      {
        id: "copy-link",
        label: ui.actionCopyLink,
        // Carries the language for the same reason SelectionLink does — a
        // shared URL should open in the language it was copied from.
        run: () =>
          copyText(`${location.origin}${location.pathname}?lang=${lang}`).then(
            () => undefined
          ),
      },
      {
        id: "github",
        label: ui.actionGithub,
        // The entry page carries its own vault paths as data attributes; no
        // repo configured, or not on an entry, and the action doesn't exist.
        when: () => !!repoUrl && !!sourcePath(lang),
        run: () => {
          const path = sourcePath(lang);
          if (!path) return;
          window.open(
            `${repoUrl}/blob/${repoBranch}/${path
              .split("/")
              .map(encodeURIComponent)
              .join("/")}`,
            "_blank",
            "noopener,noreferrer"
          );
          onClose();
        },
      },
      {
        id: "random",
        label: ui.actionRandom,
        run: () => {
          // Pages only: a heading result would land mid-note at an anchor.
          const pages = items.filter(
            (i) => !i.lang && i.href !== window.location.pathname
          );
          if (!pages.length) return;
          go(pages[Math.floor(Math.random() * pages.length)].href);
        },
      },
    ],
    [items, lang, toggleLang, onClose, go]
  );

  /** Actions matching the query, in both languages. Empty query shows all. */
  const actionResults = useMemo(() => {
    // A client component is still rendered once on the server to produce the
    // static HTML, and `when` reaches into the DOM — so it can only be asked
    // in the browser. Harmless: the palette renders nothing until it's opened,
    // which can't happen before hydration.
    const available = actions.filter(
      (a) => !a.when || (typeof document !== "undefined" && a.when())
    );
    const q = fold(query.trim());
    if (!q) return available;
    return available.filter((a) =>
      [a.label.en, a.label.uk].some((l) => fold(l).includes(q))
    );
  }, [actions, query]);

  /**
   * One flat list so ↑↓ crosses the boundary without special cases. Pages
   * always come first: typing a note's name must open the note, never run a
   * command that happens to share a word with it.
   */
  const rows = useMemo(
    () => [
      ...results.map((item) => ({ kind: "page" as const, item })),
      ...actionResults.map((action) => ({ kind: "action" as const, action })),
    ],
    [results, actionResults]
  );

  useEffect(() => setSelected(0), [rows.length, query]);

  /**
   * Park the sliding wash on the selected row.
   *
   * Measured from the live DOM rather than computed, exactly like the contents
   * rail's marker (components/Toc.tsx): rows are not all the same height and
   * group labels ("Recent", "Actions") appear between them depending on the
   * query, so the arithmetic for "where is row 4" would be a second, quietly
   * wrong copy of the list's own layout.
   *
   * `offsetTop` is relative to the list, which is the marker's offset parent
   * and the thing that scrolls — so the marker travels with the rows without
   * anything having to read a scroll position.
   */
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const marker = list.querySelector<HTMLElement>(".palette-marker");
    if (!marker) return;

    const row = list.querySelector<HTMLElement>("button.is-selected");
    // Nothing selected (an empty result set): fade out where it is rather than
    // sliding up to sit on the "no results" line.
    if (!row) {
      marker.style.opacity = "0";
      return;
    }
    marker.style.setProperty("--y", `${row.offsetTop}px`);
    marker.style.setProperty("--h", `${row.offsetHeight}px`);
    marker.style.opacity = "1";
  }, [selected, rows, open, lang]);

  const runRow = async (row: (typeof rows)[number]) => {
    if (row.kind === "page") return go(row.item.href);
    await row.action.run();
    // A copy leaves no visible trace, so acknowledge it before closing.
    if (row.action.id.startsWith("copy")) {
      setFlash(true);
      window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => {
        setFlash(false);
        onClose();
      }, 900);
    }
  };

  return (
    /* Always rendered and shown by `data-open`, so it can animate on the way
       out as well as in — React can't transition an element it has already
       removed. `inert` keeps the closed dialog out of the tab order and away
       from screen readers, which `visibility: hidden` alone wouldn't
       guarantee across browsers. */
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      data-open={open}
      inert={!open}
      className="overlay fixed inset-0 z-[60] flex items-start justify-center bg-black/30 px-4 pt-[18vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="overlay-panel w-full max-w-md overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {everOpen && (
          <>
        <div className="relative border-b border-[var(--border)]">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelected((s) => Math.min(s + 1, rows.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelected((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter" && rows[selected]) {
                runRow(rows[selected]);
              } else if (!query && shortcutKey(e) === "?") {
                /* The cheat sheet, from the one place its own key can't be
                   heard: `?` is a character to a focused input, so the global
                   listener (components/Shortcuts.tsx) stands down while the
                   palette is open. Only with an empty box — once you're
                   typing, the key is a character again, which is why the
                   footer offers it only then. `shortcutKey` for the same
                   reason ⌘K reads through it: `?` is Shift+é on a French
                   layout (lib/shortcut-key.ts). */
                e.preventDefault();
                onClose();
                window.dispatchEvent(new Event(SHORTCUTS_EVENT));
              }
            }}
            placeholder={ui.searchPlaceholder[lang]}
            className="w-full bg-transparent px-4 py-3.5 pr-12 text-[15px] text-[var(--text)] outline-none focus:outline-none focus-visible:outline-none placeholder:text-[var(--text-tertiary)]"
          />
          <button
            type="button"
            onClick={toggleLang}
            aria-label={
              lang === "en" ? "Switch to Ukrainian" : "Перемкнути на англійську"
            }
            title={lang === "en" ? "English" : "Українська"}
            /* `press` and `-translate-y-1/2` coexist: Tailwind v4 centres with
               the `translate` property, not `transform`, so the scale has the
               transform to itself. */
            className="press absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-base leading-none hover:bg-[var(--bg-hover)]"
          >
            {lang === "en" ? "🇨🇦" : "🇺🇦"}
          </button>
        </div>
        <ul ref={listRef} className="palette-list max-h-72 overflow-y-auto py-1.5">
          {/* One wash that slides between rows, rather than one switching off
              and another switching on — the same object the contents rail uses
              (.toc-marker). Positioned from the live DOM by the effect above,
              because the rows are different heights and carry group labels
              nothing here can predict. */}
          <li className="palette-marker" aria-hidden />
          {rows.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-[var(--text-tertiary)]">
              <T {...ui.noResultsFor} /> &ldquo;{query}&rdquo;
            </li>
          )}
          {/* These came from a similarity pass, not a real match — say so, or
              a near-miss reads as though it contained what you typed. */}
          {fuzzy && (
            <li className="px-4 pb-1 pt-2 text-xs text-[var(--text-tertiary)]">
              <T {...ui.didYouMean} />
            </li>
          )}
          {rows.map((row, i) => (
            <li
              key={row.kind === "page" ? row.item.href : `action:${row.action.id}`}
            >
              {/* Group labels. "Recent" only appears on an empty query, where
                  the first rows are pages you've actually been on; the rest of
                  the site follows under its own heading so the boundary is
                  visible rather than implied by order alone. */}
              {recent > 0 && i === 0 && (
                <p className="px-4 pb-1 pt-2 text-xs text-[var(--text-tertiary)]">
                  <T {...ui.recentGroup} />
                </p>
              )}
              {recent > 0 && i === recent && (
                <p className="px-4 pb-1 pt-2 text-xs text-[var(--text-tertiary)]">
                  <T {...ui.pagesGroup} />
                </p>
              )}
              {/* A divider label above the first action, so a command doesn't
                  read as another page with an odd name. */}
              {row.kind === "action" && i === results.length && (
                <p className="px-4 pb-1 pt-2 text-xs text-[var(--text-tertiary)]">
                  <T {...ui.actionsGroup} />
                </p>
              )}
              <button
                type="button"
                onClick={() => runRow(row)}
                onMouseEnter={() => setSelected(i)}
                /* No background here: the wash is the one sliding marker at
                   the top of the list. Only the text colour changes per row. */
                className={`press palette-row relative flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left text-[15px] ${
                  i === selected
                    ? "is-selected text-[var(--text)]"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                {row.kind === "page" ? (
                  <>
                    <span className="truncate font-medium">
                      {lang === "uk" && row.item.titleUk
                        ? row.item.titleUk
                        : row.item.title}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--text-tertiary)]">
                      {lang === "uk" && row.item.sectionUk
                        ? row.item.sectionUk
                        : row.item.section}
                    </span>
                  </>
                ) : (
                  <span className="truncate">
                    <T {...row.action.label} />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-[var(--border)] px-4 py-2 text-xs text-[var(--text-tertiary)]">
          {flash ? (
            <T {...ui.actionDone} />
          ) : scoped ? (
            <T {...ui.searchThisPage} />
          ) : (
            <>
              <T {...ui.searchHint} />
              {/* Advertised only while the key is free to mean this — see the
                  handler above. */}
              {!query && (
                <>
                  {" · "}
                  <T {...ui.searchHintShortcuts} />
                </>
              )}
            </>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
}
