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
  ChevronIcon,
  resolveIcon,
  CanadaFlag,
  UkraineFlag,
} from "@/components/icons";
import type { NavChildren, NavNote } from "@/lib/nav-tree";
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
import { sidebarTree } from "@/lib/site-config";

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
  /**
   * The vault folder's contents, one level down — Obsidian's tree, built by
   * lib/nav-tree.ts. Present for every section that has one; drawn only for
   * the section you're currently in, and only from 640px up.
   */
  tree?: NavChildren;
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
  const [openBy, setOpenBy] = useState<"modal" | "pinned" | "peek" | null>(null);
  const open = openBy !== null;
  const modal = openBy === "modal";
  /**
   * Read by the focus trap's cleanup, which runs on the way to `pinned` as
   * well as on the way to closed and can't tell those apart from `modal`
   * alone. Written during render on purpose: an effect would update it after
   * the cleanup has already asked.
   */
  const openByRef = useRef(openBy);
  openByRef.current = openBy;
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

  /**
   * The pointer left the panel, so the panel leaves — for a peek AND for a
   * pinned panel, which is a peek you arrived at by clicking rather than by
   * brushing the edge. Both are open only as long as you are looking at them;
   * only a MODAL panel stays put until it's dismissed.
   */
  const unpeek = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = 0;
      setOpenBy((v) => {
        if (v !== "peek" && v !== "pinned") return v;
        // The pointer left, but the keyboard is still inside: someone tabbed
        // into the panel while it was open. Closing would leave focus on a
        // link nobody can see.
        //
        // `:focus-visible` is what separates that from the ordinary case,
        // which is a MOUSE click on a nav link — that focuses the link too,
        // and guarding on focus alone would mean a pinned panel could never
        // close by the pointer leaving, since the link you just clicked is
        // always inside it.
        const held = document.activeElement;
        if (
          held instanceof HTMLElement &&
          drawerRef.current?.contains(held) &&
          held.matches(":focus-visible")
        )
          return v;
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
    setOpenBy((v) => (v === "modal" || v === "pinned" ? null : "modal"));
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
      // …but only if the panel is actually going away. Navigating demotes a
      // modal panel to `pinned`, which tears this trap down while the drawer
      // stays on screen — restoring focus there would throw the keyboard out
      // of a sidebar the reader is still using.
      if (openByRef.current !== null) return;
      if (drawer.contains(document.activeElement)) {
        (previous ?? menuButtonRef.current)?.focus();
      }
    };
  }, [modal]);

  /**
   * Navigation PINS a deliberately-opened panel instead of closing it.
   *
   * The drawer used to shut on every navigation, which was right when it was
   * only ever a list of seven sections — you opened it to go somewhere and
   * you had gone. With the vault's folders in it (lib/nav-tree.ts) it is
   * something you browse, and shutting it after each note meant re-opening it
   * and re-finding your place to read two notes in a row.
   *
   * It demotes rather than staying modal, because "don't close" and "keep the
   * page dimmed and the keyboard trapped" are different things: once you have
   * arrived, the backdrop is over the page you asked for. Pinned is open,
   * plain — no backdrop, no focus trap, not `aria-modal` — and it stays until
   * the panel icon, `m`, or Escape puts it away.
   *
   * A PEEK still closes. It is a glance held by the pointer, and the pointer
   * is on the page now.
   */
  useEffect(
    () =>
      setOpenBy((v) =>
        // Off, this is the plain "close on navigation" the drawer has always
        // had. The pin exists to serve the tree — see lib/site-config.ts.
        sidebarTree && (v === "modal" || v === "pinned") ? "pinned" : null
      ),
    [pathname]
  );

  /**
   * A press anywhere on the page puts a pinned panel away.
   *
   * A LISTENER, not a backdrop element: a pinned panel deliberately doesn't
   * dim or block the page, so the press that dismisses it must also reach
   * whatever it landed on — a link, a cover, a word being selected. A
   * transparent overlay would swallow the first click on every page.
   *
   * The menu button is exempt because `pointerdown` runs before `click`:
   * without this, pressing the icon to CLOSE a pinned panel would close it
   * here and then have `toggleMenu` re-open it as modal.
   */
  useEffect(() => {
    if (openBy !== "pinned") return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (drawerRef.current?.contains(target)) return;
      if (menuButtonRef.current?.contains(target)) return;
      setOpenBy(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [openBy]);
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

  /**
   * THE SUBTREE — the vault's folders under the section row you're standing
   * in. Only that section's, and only while you're in it: the drawer is a
   * short column and a tree for somewhere else is furniture. See
   * lib/nav-tree.ts for what counts as a folder and why nothing invents one.
   */
  const tree = section?.tree;

  /**
   * Which folder the pathname itself is asking for.
   *
   * Two shapes reach the same answer: /shelf/type/books (and its category
   * pages) names the medium outright, while /shelf/the-last-wish names a note
   * — so the tree looks the note up among the folders' own children rather
   * than trying to re-derive `medium:` in the browser, which would mean
   * shipping lib/shelf.ts to it.
   */
  const openByPath =
    segments[1] === "type"
      ? segments[2]
      : tree?.folders?.find((f) => f.notes.some((n) => n.href === pathname))?.slug;

  /**
   * Folders the READER has touched, and nothing else.
   *
   * Scoped to ONE VISIT to a section, not to the section's name — see
   * `visit` below. Anything untouched answers from `openByPath`, which is
   * what makes arriving at a medium page find that folder already open.
   */
  /**
   * A COUNTER, not the section's slug.
   *
   * Keying the overrides on the slug meant Shelf → Posts → Shelf matched the
   * old key again and handed back the folder you had open two pages ago. The
   * mask hid it while you were on Posts; it never threw it away. Counting
   * ARRIVALS gives every visit its own key, so leaving forgets — and it is
   * still a render-time reset, where an effect would cost a second render and
   * a frame of the last visit's tree.
   *
   * Navigating WITHIN a section doesn't count as an arrival, so opening a
   * folder and then reading three notes out of it keeps it open.
   */
  const visitRef = useRef({ section: sectionSlug ?? "", n: 0 });
  if (visitRef.current.section !== (sectionSlug ?? ""))
    visitRef.current = { section: sectionSlug ?? "", n: visitRef.current.n + 1 };
  const visit = visitRef.current.n;

  /**
   * WHICH FOLDER IS OPEN, per section — which folder, not which folders.
   *
   * Arithmetic, not a taste for accordions: four folder rows plus ONE open
   * list of notes fits inside the subtree's cap (#124), so every sibling
   * folder is on screen whatever is expanded. Two open lists don't fit, and
   * the ones at the bottom scroll away — which is exactly the list you needed
   * to see while choosing between them.
   *
   * It was briefly "close only the folders BELOW", to stop a collapse above
   * the pointer from sliding the list out from under it. That was a symptom
   * of folders opening on hover, which nothing does any more: a collapse now
   * only ever follows a click, where a shift is expected because you asked
   * for it.
   *
   * `undefined` means the reader hasn't touched this section's folders and
   * the pathname answers instead; `null` means they closed the open one.
   */
  const [folderOpen, setFolderOpen] = useState<{
    visit: number;
    map: Record<string, string | null>;
  }>({ visit: -1, map: {} });
  const overrides = folderOpen.visit === visit ? folderOpen.map : {};
  const openIn = (item: string) =>
    overrides[item] !== undefined
      ? overrides[item]
      : item === sectionSlug
        ? (openByPath ?? null)
        : null;
  const isFolderOpen = (item: string, folder: string) => openIn(item) === folder;
  const write = (item: string, next: string | null) =>
    setFolderOpen((prev) => ({
      visit,
      map: { ...(prev.visit === visit ? prev.map : {}), [item]: next },
    }));
  /**
   * THE TWISTY IS THE ONLY THING THAT OPENS OR SHUTS A FOLDER.
   *
   * Folders unfolded on a hover dwell for a while, and so did the section
   * subtrees above them; both were taken back out. A row opening itself under
   * the pointer while you read the list is the drawer making decisions on
   * your behalf, and it moves everything below it while you are trying to
   * aim. Clicking is instant and reversible; the only automatic open left is
   * the pathname's own (`openByPath`), which describes where you already are
   * rather than guessing where you're headed.
   */
  const toggleFolder = (item: string, folder: string) =>
    write(item, isFolderOpen(item, folder) ? null : folder);

  /**
   * THE TREE ONLY EXISTS IN A PANEL YOU MEANT TO OPEN.
   *
   * A peek is a glance held by the pointer at the left edge — you are looking
   * for Posts, not reading a file tree, and unfolding twenty-nine notes under
   * something you brushed past is the drawer answering a question nobody
   * asked. `pinned` keeps it, because a pinned panel IS a button-opened one:
   * it is what a deliberate open becomes after you follow a link out of it,
   * and browsing on is the whole reason it stays.
   */
  const treeReady = openBy === "modal" || openBy === "pinned";

  /**
   * The row the reader is standing on, so opening the panel can scroll to it.
   *
   * The tree is capped (see `.nav-tree` in globals.css) and a folder can hold
   * eighteen notes, so "you are here" is regularly below the fold of a box
   * that is itself inside a scrolling nav — and a drawer that opens on the
   * wrong part of the list answers the question you didn't ask.
   */
  const hereRef = useRef<HTMLAnchorElement | null>(null);

  /**
   * Bring it into view WITHOUT `scrollIntoView`, which walks every scrollable
   * ancestor up to the document. While the panel is shut it sits a full panel
   * width off the left of the window, so letting the browser "reveal" it can
   * scroll the page sideways. This only ever writes `scrollTop` on boxes that
   * actually overflow, and never touches the window.
   */
  useEffect(() => {
    if (!open) return;
    const el = hereRef.current;
    if (!el) return;
    for (let box = el.parentElement; box && box !== document.body; box = box.parentElement) {
      if (box.scrollHeight <= box.clientHeight + 1) continue;
      const row = el.getBoundingClientRect();
      const frame = box.getBoundingClientRect();
      if (row.top < frame.top) box.scrollTop -= frame.top - row.top + 8;
      else if (row.bottom > frame.bottom) box.scrollTop += row.bottom - frame.bottom + 8;
    }
  }, [open, pathname]);

  /** One note row. `title` carries the full string, since the row is one line. */
  const leaf = (note: NavNote) => {
    const here = pathname === note.href;
    return (
      <Link
        href={note.href}
        ref={here ? hereRef : undefined}
        className={`nav-leaf press${here ? " is-here" : ""}`}
        title={lang === "uk" && note.titleUk ? note.titleUk : note.title}
      >
        <T en={note.title} uk={note.titleUk} />
      </Link>
    );
  };

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
            const active = isActive(item.href);
            // The subtree belongs to the section you're IN, and only in a
            // panel you meant to open. Everywhere else this row is exactly
            // the row it has always been.
            const sub = treeReady && active ? item.tree : undefined;
            return (
              <div key={item.slug} className="nav-item">
                <Link
                  href={item.href}
                  className={`press flex items-center gap-3.5 rounded-lg px-3 py-2 text-lg ${
                    active
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

                {sub ? (
                  <ul className="nav-tree">
                    {sub.folders?.map((folder) => {
                      // Not `open` — that name is the DRAWER's, and shadowing
                      // it here is how the two states start disagreeing.
                      const expanded = isFolderOpen(item.slug, folder.slug);
                      const word = expanded ? ui.collapseFolder : ui.expandFolder;
                      // The medium page and its category pages are one page
                      // with a different chip pressed (#65), so both light
                      // the folder rather than only the bare medium URL.
                      const folderHere =
                        pathname === folder.href || pathname.startsWith(folder.href + "/");
                      return (
                        <li key={folder.slug}>
                          {/* TWO CONTROLS, TWO ANSWERS, and that is the whole
                              point: the twisty opens the folder in place, the
                              NAME goes to the folder's own page. A button
                              can't live inside a link, so they are siblings
                              sharing one row rather than one control guessing
                              which you meant. */}
                          <div className="nav-branch">
                            <button
                              type="button"
                              className="nav-twisty press"
                              aria-expanded={expanded}
                              aria-controls={`nav-folder-${folder.slug}`}
                              aria-label={`${word[lang]} ${folder.label[lang]}`}
                              onClick={() => toggleFolder(item.slug, folder.slug)}
                            >
                              <ChevronIcon className="h-3.5 w-3.5" />
                            </button>
                            <Link
                              href={folder.href}
                              ref={folderHere ? hereRef : undefined}
                              className={`nav-child press${folderHere ? " is-here" : ""}`}
                            >
                              <T {...folder.label} />
                            </Link>
                          </div>
                          <ul
                            id={`nav-folder-${folder.slug}`}
                            className="nav-tree nav-tree-deep"
                            hidden={!expanded}
                          >
                            {folder.notes.map((note) => (
                              <li key={note.href}>{leaf(note)}</li>
                            ))}
                          </ul>
                        </li>
                      );
                    })}
                    {/* A section with no folders of its own — Posts, Music,
                        Projects — hangs its notes straight off the row, which
                        is what the vault does too. */}
                    {sub.notes?.map((note) => (
                      <li key={note.href}>{leaf(note)}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
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
