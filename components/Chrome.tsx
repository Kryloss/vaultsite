"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  PanelIcon,
  SearchIcon,
  resolveIcon,
  CanadaFlag,
  UkraineFlag,
} from "@/components/icons";
import CommandPalette from "@/components/CommandPalette";
import SocialLinks from "@/components/SocialLinks";
import { TIME_LEFT_EVENT } from "@/components/ReadingProgress";
import { warmSearchIndex } from "@/components/useSearchIndex";
import Shortcuts from "@/components/Shortcuts";
import ResistanceDay from "@/components/ResistanceDay";
import T from "@/components/T";
import { useLang } from "@/components/useLang";
import { ui } from "@/lib/ui-strings";
import { homeName } from "@/lib/site-config";

export interface NavItem {
  slug: string;
  title: string;
  titleUk?: string;
  icon?: string;
}

/**
 * Site chrome, brianlovin-style: a floating panel icon plus a clickable
 * breadcrumb naming the current page's ancestors — a post under Posts reads
 * "Posts · Kyrylo", not "Post Sample · Posts · Kyrylo".
 * The sidebar starts hidden, slides in flat, and closes via backdrop/Escape.
 */
export default function Chrome({
  items,
  siteName,
  siteNameUk,
  resistanceDay,
  children,
}: {
  items: NavItem[];
  siteName: string;
  /** Ukrainian form of `siteName`, for the breadcrumb only — see lib/site-config.ts. */
  siteNameUk: string;
  /** Build-time day count for the sidebar line — see lib/resistance.ts */
  resistanceDay: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  /** Phones only: drop the breadcrumb while reading downward. */
  const [compact, setCompact] = useState(false);
  /**
   * Minutes left in the article, published by components/ReadingProgress.tsx.
   *
   * On a phone this bar shows the breadcrumb when you arrive and the time
   * remaining once you start reading — the two answer the same question at
   * different moments ("where am I" / "how much is left"), and there is only
   * room for one. Null on any page that isn't a timed article.
   */
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const { lang, toggle: toggleLang } = useLang();
  const pathname = usePathname();

  /**
   * Collapse the bar to just its button when the reader scrolls down, restore
   * it when they scroll back up or reach the top. The breadcrumb says where
   * you are, which matters when you arrive and stops mattering once you're
   * reading — and on a phone it's the widest thing covering the article.
   *
   * Direction-based rather than position-based, so it comes back the moment
   * you look for it instead of only at the top of the page.
   */
  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const y = window.scrollY;
      const delta = y - last;
      // Ignore sub-pixel jitter and rubber-banding, or it flickers.
      if (Math.abs(delta) < 6) return;
      last = y;
      setCompact(y > 72 && delta > 0);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // A new page starts at the top, so the breadcrumb should be showing.
  useEffect(() => setCompact(false), [pathname]);

  // …and carries no reading estimate until the new article publishes one.
  useEffect(() => setTimeLeft(null), [pathname]);

  useEffect(() => {
    const onTime = (e: Event) => {
      const detail = (e as CustomEvent<number | null>).detail;
      setTimeLeft(typeof detail === "number" ? detail : null);
    };
    window.addEventListener(TIME_LEFT_EVENT, onTime);
    return () => window.removeEventListener(TIME_LEFT_EVENT, onTime);
  }, []);

  /**
   * Focus follows the drawer, and comes back when it closes.
   *
   * It's a modal panel over a backdrop, so the keyboard has to go in with it:
   * without this, opening the menu left focus on the button behind the
   * overlay and the first Tab landed somewhere invisible. `inert` on the
   * closed drawer does the other half — a panel translated off-screen is
   * still focusable, so every page used to begin with a tab through seven
   * links nobody could see.
   *
   * Focus is only restored if it's still inside the drawer at the time:
   * closing by clicking a link navigates, and yanking focus back to the menu
   * button would undo the browser's own reset.
   */
  useEffect(() => {
    if (!open) return;
    const drawer = drawerRef.current;
    if (!drawer) return;

    const previous = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );

    focusables()[0]?.focus();

    // Tab wraps inside the panel rather than walking into the hidden page.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (drawer.contains(document.activeElement)) {
        (previous ?? menuButtonRef.current)?.focus();
      }
    };
  }, [open]);

  // Close the drawer on navigation; Escape closes it; Cmd/Ctrl+K opens search.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openSearch = useCallback(() => setSearchOpen(true), []);

  /**
   * Whether the chip should swap its label at all.
   *
   * The breadcrumb only gives way when there is something to give way TO. On a
   * section list, the home page, or any note without a reading estimate there
   * is no time remaining, so collapsing would animate the breadcrumb out and
   * leave an empty chip — motion that costs the reader attention and returns
   * nothing. Those pages simply keep their breadcrumb.
   */
  const swap = compact && timeLeft !== null;

  const nav = items.map((item) => ({
    ...item,
    href: item.slug === "home" ? "/" : `/${item.slug}`,
  }));

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  // Breadcrumb: where the current page SITS, not what it is. Its own title is
  // already the <h1> directly below, so naming it here said the same thing
  // twice — the deepest crumb is the current page's parent.
  //
  // The section is the only ancestor there is, at any depth. A shelf medium
  // (/shelf/type/books) and its categories (/shelf/type/books/fantasy) are one
  // page with a different chip pressed — same heading, same chips, same grid —
  // so naming the medium said "Books" beside an <h1> reading "Books", and said
  // it on some of those URLs and not others. Both now read "Shelf · Kyrylo",
  // and the trail no longer changes shape while the page doesn't.
  const segments = pathname.split("/").filter(Boolean);
  const [sectionSlug] = segments;
  const section = sectionSlug ? nav.find((i) => i.slug === sectionSlug) : undefined;

  // Site name first, section after — "Kyrylo · Music" reads the way the
  // trail is walked (home, then in), rather than most-specific-first. Home
  // has no parent, so the name stands alone there rather than leaving the bar
  // empty — and switches to the surname, since it's naming the page rather
  // than leading a path. See lib/site-config.ts.
  const isHome = segments.length === 0;
  const crumbs: { en: string; uk?: string; href: string }[] = [
    isHome
      ? { ...homeName, href: "/" }
      : { en: siteName, uk: siteNameUk, href: "/" },
  ];
  // Skipped on the section's own page, which sits at the root.
  if (section && section.slug !== "home" && segments.length > 1)
    crumbs.push({ en: section.title, uk: section.titleUk, href: `/${section.slug}` });

  return (
    <>
      {/* First thing in the tab order, invisible until it has focus: the site
          chrome is a menu button, a breadcrumb and a search box before any
          article begins, and a keyboard reader shouldn't have to walk them on
          every page. */}
      <a href="#main" className="skip-link">
        <T {...ui.skipToContent} />
      </a>

      {/* Floating top-left: panel icon + clickable location path */}
      {/* `data-compact` drives the swap between the breadcrumb and the time
          remaining; both live here so the bar never changes width abruptly.
          Below 640px only — see globals.css. */}
      <div
        /* Fill and hairline come from `.chrome-bar` in globals.css, where they
           share the `--chrome-bg` token with the contents pill in the opposite
           corner — they're the same object twice and can't be allowed to
           drift. */
        className="chrome-bar fixed left-3 top-3 z-30 flex items-center gap-1 rounded-full px-1.5 py-1 backdrop-blur-md"
        data-compact={swap}
      >
        <button
          ref={menuButtonRef}
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="site-menu"
          onClick={() => setOpen((v) => !v)}
          className="press flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
        >
          <PanelIcon className="h-[18px] w-[18px]" />
        </button>
        {/* The breadcrumb and the time remaining occupy the SAME cell, one
            above the other, and slide vertically past each other on a phone.
            Stacked rather than side by side so the chip's width is the wider
            of the two at all times and never changes during the swap — the
            version that animated widths bulged and then settled, because two
            things were resizing at once and their sum peaked in the middle.

            The time is always rendered, even with nothing to say: an element
            mounted mid-swap has no previous style to animate from, which is
            its own kind of jump. */}
        <span className="bar-swap">
          <span className={`crumbs${swap ? " is-collapsed" : ""}`}>
          {crumbs.map((crumb, i) => (
            <Fragment key={crumb.href}>
              {i > 0 && <span className="text-[var(--text-tertiary)]"> · </span>}
              <Link
                href={crumb.href}
                className={`transition-colors hover:text-[var(--text)] ${
                  /* The full-colour crumb is whichever one is CLOSEST to the
                     current page — last now that the site name leads. On
                     home there's only one crumb and it isn't naming
                     anywhere closer than the page you're already on, so it
                     stays the quiet grey rather than borrowing the emphasis
                     that elsewhere marks "this is where you are". */
                  i === crumbs.length - 1 && !isHome
                    ? "text-[var(--text)]"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                <T en={crumb.en} uk={crumb.uk} />
              </Link>
            </Fragment>
          ))}
          </span>
          <span className="bar-time" aria-hidden={timeLeft === null}>
            {timeLeft !== null && (
              <>
                {timeLeft} <T {...ui.minLeft} />
              </>
            )}
          </span>
        </span>
      </div>

      {/* Backdrop */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/25 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Drawer — flat: page background, hairline border, text + icons only */}
      <aside
        ref={drawerRef}
        id="site-menu"
        /* A panel over a backdrop that takes the keyboard with it is a modal
           dialog, whatever it looks like. `inert` keeps the closed one out of
           the tab order and the accessibility tree entirely. */
        role="dialog"
        aria-modal="true"
        aria-label={lang === "uk" ? "Меню сайту" : "Site menu"}
        inert={!open}
        className={`fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-[var(--border)] bg-[var(--bg)] py-5 transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 pb-5">
          <Link href="/" className="text-base font-semibold text-[var(--text)]">
            <T en={siteName} uk={siteNameUk} />
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleLang}
              aria-label={
                lang === "en" ? "Switch to Ukrainian" : "Перемкнути на англійську"
              }
              title={lang === "en" ? "English — switch to Ukrainian" : "Українська — перемкнути на англійську"}
              className="press flex h-8 w-8 items-center justify-center rounded-md text-base leading-none hover:bg-[var(--bg-hover)]"
            >
              {/* Shows the CURRENT language's flag */}
              {lang === "en" ? "🇨🇦" : "🇺🇦"}
            </button>
            <button
              type="button"
              aria-label="Search (⌘K)"
              title="Search (⌘K)"
              onClick={() => {
                setOpen(false);
                setSearchOpen(true);
              }}
              /* Start fetching the index as the pointer arrives, so the panel
                 usually opens onto results rather than an empty list. */
              onPointerEnter={warmSearchIndex}
              className="press flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
            >
              <SearchIcon className="h-[17px] w-[17px]" />
            </button>
          </div>
        </div>

        <nav className="flex flex-col gap-3 overflow-y-auto px-3">
          {nav.map((item) => {
            const Icon = resolveIcon(item.icon);
            return (
              <Link
                key={item.slug}
                href={item.href}
                className={`press flex items-center gap-3.5 rounded-lg px-3 py-2 text-lg ${
                  isActive(item.href)
                    ? "bg-[var(--bg-hover)] font-medium text-[var(--text)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
                }`}
              >
                {/* The emoji fallback matches the SVG box so both alignments
                    share one column — see resolveIcon() in components/icons.tsx. */}
                {Icon ? (
                  <Icon className="h-6 w-6 shrink-0 opacity-75" />
                ) : item.icon ? (
                  <span className="w-6 shrink-0 text-center text-lg leading-none">{item.icon}</span>
                ) : null}
                <span><T en={item.title} uk={item.titleUk} /></span>
              </Link>
            );
          })}
        </nav>

        {/* Social links — plain icons, no background. Rendered by the same
            component as the home page's row (at a smaller size) rather than a
            second copy of the markup: this one had drifted to its own hover
            behaviour, which is exactly what duplicated chrome does. */}
        <div className="mt-auto px-6 pt-6">
          <SocialLinks iconClass="h-[21px] w-[21px]" gap="gap-4" />
          {/* Sized to fit the w-56 sidebar on one line — see lib/resistance.ts */}
          <p className="mt-4 whitespace-nowrap text-[11px] tracking-tight text-[var(--text-tertiary)]">
            <ResistanceDay initial={resistanceDay} />
          </p>
        </div>
      </aside>

      <CommandPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />

      {/* Mounted here rather than in the layout because it needs the same nav
          list the sidebar shows — `g 1…9` follows that order. `openSearch` is
          memoized so its key listener isn't torn down on every render. */}
      <Shortcuts items={items} onSearch={openSearch} />

      {/* Content — re-animates on each navigation via the pathname key */}
      <main id="main" key={pathname} className="page-in min-w-0">
        {children}
      </main>
    </>
  );
}
