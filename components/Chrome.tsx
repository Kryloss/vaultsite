"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
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
import type { ObservanceId } from "@/lib/observances";
import T from "@/components/T";
import { useLang } from "@/components/useLang";
import { ui } from "@/lib/ui-strings";
import { shortcutKey } from "@/lib/shortcut-key";

/**
 * How long the pointer has to stay in the left edge strip before the panel
 * answers, in milliseconds.
 *
 * Opening was instant, and instant is wrong for a target you can hit without
 * meaning to. The strip runs the full height of the window at x < 16px, so
 * every throw of the pointer at the browser's back button, every overshoot on
 * the way to a link near the left margin, and every pass across the screen
 * that happens to end short slid a sidebar out over the page.
 *
 * Small enough that a deliberate move to the edge still feels like the panel
 * was already there — the pointer has not finished settling at 90ms, and the
 * 300ms slide starts from under it either way. Long enough that a pointer
 * merely PASSING through the strip is gone before the timer fires. It buys
 * intent, not deliberation: this is not a hover-intent heuristic measuring
 * velocity, just the shortest dwell that distinguishes arriving from crossing.
 */
const PEEK_DELAY = 90;

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
  observance,
  constellation,
  children,
}: {
  items: NavItem[];
  siteName: string;
  /** Ukrainian form of `siteName`, for the breadcrumb only — see lib/site-config.ts. */
  siteNameUk: string;
  /** Build-time day count for the sidebar line — see lib/resistance.ts */
  resistanceDay: number;
  /** Build-time answer to "is today a Ukrainian national day" — see lib/observances.ts */
  observance: ObservanceId | null;
  /**
   * The note grid for the drawer's footer, rendered as an ELEMENT by the
   * layout rather than built from props here.
   *
   * It reads the vault, and this is a client component: importing it would
   * drag `lib/vault.ts` and its `fs` calls into the browser bundle. Handed in
   * already-rendered, it stays server-side and this file stays a shell.
   */
  constellation?: ReactNode;
  children: ReactNode;
}) {
  /**
   * WHAT KIND of open, not just whether it's open.
   *
   * A deliberate open — the panel icon, or the `m` key — is a decision: the
   * panel is modal, takes the keyboard, dims the page, and stays until it's
   * dismissed. Brushing the left edge is a glance: the panel slides in under
   * the pointer and leaves again when the pointer does, without a backdrop
   * and without moving focus — a peek that stole the keyboard would punish
   * you for aiming badly. One state answers both questions, so the two can
   * never disagree about whether it's open.
   *
   * Named for the kind rather than the input, because more than one input
   * arrives at each: a click and a keypress both mean "modal".
   */
  const [openBy, setOpenBy] = useState<"modal" | "peek" | null>(null);
  const open = openBy !== null;
  const modal = openBy === "modal";
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
   * The hover peek, and the two delays that make an invisible edge target
   * usable — one before it opens, one before it closes.
   *
   * OPENING waits `PEEK_DELAY` (see above), so the strip answers a pointer
   * that arrives rather than one that passes through.
   *
   * CLOSING waits longer. Clipping the corner on the way somewhere else, or
   * crossing the hairline border for a frame, shouldn't slam the panel shut
   * and reopen it. The asymmetry is deliberate and it's the usual one for
   * hover-revealed surfaces: opening by accident costs the reader the page
   * they were looking at, closing by accident costs them the thing they were
   * reaching for, and the second is the more annoying of the two — so the
   * cheap mistake gets the short fuse.
   */
  const closeTimer = useRef(0);
  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = 0;
    }
  }, []);

  /**
   * The pending open, cancelled when the pointer leaves the strip before the
   * delay is up — which is the whole point of having a delay.
   *
   * Also fires harmlessly once per successful peek: the panel slides out over
   * the strip it came from, so the edge zone gets a `pointerleave` the moment
   * it opens. By then the timer has already run and the ref is 0.
   */
  const openTimer = useRef(0);
  const cancelOpen = useCallback(() => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = 0;
    }
  }, []);

  const peek = useCallback(
    (e: ReactPointerEvent) => {
      // The media query already keeps this strip off touch screens; a hybrid
      // device can still deliver a touch here, and a tap near the edge is a
      // scroll, not a request for the menu.
      if (e.pointerType === "touch") return;
      // Never slide the page's own navigation in under an open dialog.
      if (searchOpen) return;
      cancelClose();
      // Re-entering the strip while a peek is already pending restarts
      // nothing — the dwell that's been accumulating is the one that counts.
      if (openTimer.current) return;
      openTimer.current = window.setTimeout(() => {
        openTimer.current = 0;
        setOpenBy((v) => v ?? "peek");
      }, PEEK_DELAY);
    },
    [cancelClose, searchOpen]
  );

  const unpeek = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = 0;
      setOpenBy((v) => {
        if (v !== "peek") return v;
        // The pointer left, but the keyboard is still inside: someone tabbed
        // into the panel while it was open. Closing would leave focus on a
        // link nobody can see.
        if (drawerRef.current?.contains(document.activeElement)) return v;
        return null;
      });
    }, 180);
  }, [cancelClose]);

  useEffect(
    () => () => {
      cancelClose();
      cancelOpen();
    },
    [cancelClose, cancelOpen]
  );

  /**
   * Open the panel deliberately, or close it — the panel icon and the `m` key
   * are the same gesture arriving two ways, so they share one function rather
   * than each writing the state.
   *
   * A peek is PROMOTED, never closed: whichever input did this, the panel is
   * already open (the pointer is resting on the icon, or the edge), and
   * closing would read as the click or the key having done nothing.
   */
  const toggleMenu = useCallback(() => {
    cancelClose();
    // The button overlaps the strip, so reaching for it arms a peek on the
    // way. Left pending, it would fire 90ms after a click that CLOSED the
    // panel and open it again as a peek.
    cancelOpen();
    setOpenBy((v) => (v === "modal" ? null : "modal"));
  }, [cancelClose, cancelOpen]);

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
   *
   * Only for the MODAL panel — the icon or the `m` key. A peek is a glance
   * with the pointer,
   * and pulling the keyboard into it would mean drifting past the edge of the
   * window moved focus. The peeked panel is still tabbable — it's on screen —
   * it just isn't entered for you.
   */
  useEffect(() => {
    if (!modal) return;
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
  }, [modal]);

  // Close the drawer on navigation; Escape closes it; Cmd/Ctrl+K opens search.
  useEffect(() => setOpenBy(null), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // `cancelOpen` too: dismissing with the pointer still resting in the
      // edge strip must not let a peek armed a moment ago undo the Escape.
      if (e.key === "Escape") {
        cancelOpen();
        setOpenBy(null);
      }
      // Read through shortcutKey for the same reason every other shortcut is:
      // ⌘K under a Cyrillic layout arrives as `л` (see lib/shortcut-key.ts).
      if ((e.metaKey || e.ctrlKey) && shortcutKey(e) === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancelOpen]);

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
  // trail is walked (home, then in), rather than most-specific-first.
  //
  // HOME HAS NO CRUMB AT ALL. It used to carry the surname, on the reasoning
  // that a bar naming nowhere should at least sign the page; but a crumb is a
  // trail, and on home the trail is empty. Naming it there put a word in the
  // bar whose only link pointed at the page you were already on, and paid for
  // it in width across the top-left corner of the site's most-looked-at page.
  // What's left is the panel button — the one control the bar has always had
  // that actually goes somewhere — sitting on its own as a round chip.
  const isHome = segments.length === 0;
  const crumbs: { en: string; uk?: string; href: string }[] = isHome
    ? []
    : [{ en: siteName, uk: siteNameUk, href: "/" }];
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
        /* No `backdrop-blur-*` here: `.chrome-bar` layers its own, so the
           blur can fall off toward the rim instead of stopping dead at it. */
        /* PADDING IS CONSTANT, on home and everywhere else. The chip is the
           only piece of chrome that survives a navigation intact, and the
           button inside it is the only thing in the chip that's on every page.
           Tightening the padding on home to square the pill up moved that
           button 2px sideways the moment you arrived — a control shifting
           under the pointer while the page behind it is still settling, which
           is the one kind of motion a fixed element must not make. Home's chip
           is a 44×40 pill rather than a circle, and the button doesn't move.
           (Squaring it the other way — growing the height to 44 — is worse
           still: this bar and `.toc-bar` are built to the same 2.5rem, #51.) */
        className="chrome-bar fixed left-3 top-3 z-30 flex items-center gap-1 rounded-full px-1.5 py-1"
        data-compact={swap}
      >
        <button
          ref={menuButtonRef}
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="site-menu"
          /* The key is advertised here the way ⌘K is on the search button —
             the tooltip is where someone finds out the shortcut exists. */
          title={lang === "uk" ? "Меню (m)" : "Menu (m)"}
          onClick={toggleMenu}
          /* No hover wash here, unlike the buttons inside the drawer: this one
             sits ON the translucent chip, and a filled square inside a
             translucent pill is two stacked surfaces where the reader should
             see one. The glyph coming up to full `--text` is the whole hover
             state, and `.press` still answers the click. */
          className="press flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text)]"
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
        {crumbs.length > 0 && (
          <span className="bar-swap">
            <span className={`crumbs${swap ? " is-collapsed" : ""}`}>
              {crumbs.map((crumb, i) => (
                <Fragment key={crumb.href}>
                  {i > 0 && (
                    <span className="text-[var(--text-tertiary)]"> · </span>
                  )}
                  <Link
                    href={crumb.href}
                    className={`transition-colors hover:text-[var(--text)] ${
                      /* The full-colour crumb is whichever one is CLOSEST to
                         the current page — last now that the site name leads.
                         Home renders no crumbs at all, so there's no longer a
                         lone crumb that would be pointing at the page you're
                         already standing on. */
                      i === crumbs.length - 1
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
        )}
      </div>

      {/* The left edge, live to the pointer. A strip this narrow is under the
          scrollbar's width on the other side and over nothing you'd click, so
          it costs the page nothing until you aim at it. Pointer devices only
          — see `.edge-zone` in globals.css. */}
      <div
        aria-hidden
        className="edge-zone fixed inset-y-0 left-0 z-20 w-4"
        onPointerEnter={peek}
        onPointerLeave={cancelOpen}
      />

      {/* Backdrop — the clicked panel only. Dimming the page every time the
          pointer crosses the edge would make a glance feel like a decision. */}
      <div
        aria-hidden
        onClick={() => setOpenBy(null)}
        /* THE WHOLE VIEWPORT, including behind the panel.
           Two attempts stopped it short of the panel's edge — first a static
           `left-56`, then a transform tracking the slide — on the theory that
           a dimming layer under a translucent sidebar would tint the sidebar.
           It does, and that turns out to be right: a translucent panel over a
           dimmed page IS darker, the way every sheet on every platform is.
           What's wrong is stopping the dim at the panel's edge, because then
           the page reads bright THROUGH the panel and dark beside it, and the
           sidebar looks like a window cut out of the page rather than a layer
           over it. That's the doubled edge, and it only ever showed when
           opening by the icon — the peek has no backdrop to give it away. */
        className={`fixed inset-0 z-40 bg-black/25 transition-opacity duration-300 ${
          modal ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Drawer — text and icons only, on the same translucent material as the
          two floating bars, with a hairline down its right edge. It was a flat
          panel of `--bg` first, which reads as a door; see DECISIONS #81. */}
      <aside
        ref={drawerRef}
        id="site-menu"
        /* A panel over a backdrop that takes the keyboard with it is a modal
           dialog, whatever it looks like. `inert` keeps the closed one out of
           the tab order and the accessibility tree entirely. */
        role="dialog"
        /* A peek doesn't take the keyboard or cover the page, so it isn't
           modal and shouldn't tell a screen reader the rest of the site has
           gone away. */
        aria-modal={modal}
        aria-label={lang === "uk" ? "Меню сайту" : "Site menu"}
        inert={!open}
        onPointerEnter={cancelClose}
        onPointerLeave={unpeek}
        /* Fill, hairline and the layered blur come from `.sidebar-panel` in
           globals.css, the same way the two floating bars get theirs. */
        className={`sidebar-panel fixed inset-y-0 left-0 z-50 flex w-56 flex-col py-5 transition-transform duration-300 ease-out ${
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
                setOpenBy(null);
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
          {constellation}
          <SocialLinks iconClass="h-[21px] w-[21px]" gap="gap-4" />
          {/* Sized to fit the w-56 sidebar on one line — see lib/resistance.ts */}
          <p className="mt-4 whitespace-nowrap text-[11px] tracking-tight text-[var(--text-tertiary)]">
            <ResistanceDay initial={resistanceDay} initialObservance={observance} />
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
      <Shortcuts items={items} onSearch={openSearch} onMenu={toggleMenu} />

      {/* Content — re-animates on each navigation via the pathname key */}
      <main id="main" key={pathname} className="page-in min-w-0">
        {children}
      </main>
    </>
  );
}
