# Site chrome

`components/Chrome.tsx` owns the drawer, breadcrumb bar and global chrome; `app/layout.tsx` hands it nav items, the constellation element and the day/observance props. Reasons: DECISIONS #7, #34, #35, #37, #38, #46, #50, #53, #65–#68, #74–#83, #104, #108, #124.

## Drawer

- Closed by default at every width. Opened by the panel icon or `m` → **modal** (backdrop, focus trapped, stays until dismissed); by the pointer on `.edge-zone` (16px, `(hover: hover) and (pointer: fine)` only) → **peek** (no backdrop, not `aria-modal`, focus untouched, opens after `PEEK_DELAY` 90ms of dwell, closes ~180ms after the pointer leaves unless the keyboard is inside). `openBy` records the kind. Clicking the icon while peeking promotes to modal. Stays mounted, `inert` when closed, skip link first in the tab order.
- No permanent nav rail at any width — built and removed (#62).
- **Second level, parked** behind `sidebarTree` in `lib/site-config.ts` (`false`): `lib/nav-tree.ts` shows the vault's own folders under the active section. If turned on: only one folder open per section, outer list capped at `min(38vh, 17rem)` and a folder's notes at `min(26vh, 10rem)` (one decision in two files), scroll-into-view by `scrollTop` never `scrollIntoView`, a folder opens by its twisty or the pathname and by nothing else (no hover dwells — removed, don't rebuild), open state keyed on a count of arrivals, `nav-tree-in` keyframe names only `from`, `.nav-tree[hidden]` must be restated, desktop only from 640px by `display: none`. Navigation then PINS a deliberately opened panel (`openBy: "pinned"`: open, no backdrop, no trap; leaves by pointer or a document `pointerdown`, menu button exempt; `unpeek` checks `:focus-visible`).
- Icons render in the sidebar only; `resolveIcon()` maps `icon:` emoji to SVGs.
- Styling (layered blur, inset hairline, full-viewport backdrop, no `isolation: isolate`): `docs/DESIGN-SYSTEM.md`.

## Constellation

`components/Constellation.tsx` (server) → `ConstellationStrip.tsx` (client), `lib/constellation.ts`, tested. One bar per week for six months, height = count against the busiest week, no tone ramp. `WEEKS = 25` at 6px + 1px gap = 174px of the drawer's 176px — bar, gap and `WEEKS` are one decision in two files. The total line shows on hover/focus and hides while a week is open; a bar's summary hangs under it at `--x = index × 7px`, right-aligned near the end. Clicking a bar opens that week's notes in flow as sidebar rows (one list refilled per week, `inert` when closed, capped `min(28vh, 10rem)` on the `<ul>`), outside clicks via a `pointerdown` listener, collapsed when the drawer closes via an `IntersectionObserver`; under 700px tall or 639px wide it floats as a card (`--strip-h`). Bars are buttons. Rendered by the layout and passed as an element so `Chrome` never imports `lib/vault.ts`; `today` is a prop; `shortDate` lives in `lib/dates.ts`.

## The last line

`components/ResistanceDay.tsx`, `lib/observances.ts`, strings in `observanceName`. "Day N of Ukraine's resistance" (from 20 Feb 2014), a monobank link styled as nothing. On fifteen national days it names the day; `kind` picks the treatment — eight `celebration`s take the flag (`--ua-blue`/`--ua-yellow`, hard-edged two-stop gradient clipped to text at 62%, `line-height: 1`, opacity 0.7), seven `remembrance` days take `.observance-quiet` (`--text-secondary`), which must sit BELOW the `@supports` block or the line renders blank. Adding a day is one row in `DAYS` plus one string pair; every string must fit 176px on one line at 11px in both languages (measure it). Vyshyvanka and Holodomor days are placed by `nthWeekday()`. Props from the layout AND a client re-read of `new Date()`. `lib/observances.test.ts` pins every date and that no day of mourning is a celebration.

## Breadcrumb bar and pills

- Names ancestors, not the page: "Kyrylo · Posts"; root first, last crumb in full colour; on home no label cell at all and the chip's padding is not conditional; on any shelf page "Kyrylo · Shelf".
- Below 640px the bar swaps the breadcrumb for the time remaining once you read down: one grid cell, vertical swap, both labels always in the DOM, the time `display: none` above 640px, and the swap only when there is a number (`TIME_LEFT_EVENT`, published when the rounded minute changes, `null` on unmount).
- The contents pill is the three-line icon alone in the top-right below 1168px, 2.5rem like the bar opposite; the sheet hangs under it (13.5rem × 55vh); no labelled variant exists. `.music-pill` steps left when both are present.

## First-visit intro

`components/Intro.tsx`, gate script in `app/layout.tsx`, `lib/intro.ts` (tested against the 8s failsafe). The real `<h1>` types itself once per browser (`intro-seen` — the key is duplicated in the gate script and the component; change both). Everything hangs off `data-intro` on `<html>`; nothing is hidden in the HTML; reduced motion never arms it. Three ends: any input, the driver, the failsafe. Load-bearing: the heading is hidden until `.tw` exists; chrome is hidden/revealed BY NAME (`.skip-link`, `.chrome-bar`, `.edge-zone` — add new always-visible chrome to those lists by hand, never `body > *:not(main)`); character spans are never reassembled. The gate keeps its `pathname === '/'` check.

## Keyboard shortcuts

`components/Shortcuts.tsx`: `[`/`]` prev/next (read from the footer's links), `j`/`k` list rows via `.stagger` with real focus and `.list-focus` painting the hover wash, `g h`, `g 1…9`, `l` language, `m` menu (modal), `/` search, `?` sheet. Every key goes through `shortcutKey()` (`lib/shortcut-key.ts`: `e.key`, then the Latin label of `e.code`) — adding a key outside letters, digits, brackets and slash needs `SHORTCUT_CHARS` and the code map. The palette forwards `?` on an empty query via a `shortcuts` window event. Never fires in a dialog; doesn't swallow keys on a page with no list; the listener is never re-subscribed on render (`sections` and `useLang().toggle` are memoized).

## Command palette

`components/CommandPalette.tsx` over `/search-index.json` (`app/search-index.json/route.ts`), fetched on first open by `useSearchIndex.ts`. Heading anchors are minted with `github-slugger`, never `slugify()` (it strips Cyrillic); heading results carry `lang`. Opens onto recents (`lib/recents.ts`, twelve paths, five shown, current page filtered, skipped in `>` mode). Actions sort below pages: language, copy as Markdown (clicks `button.copy-md`), copy link, open on GitHub (`repoUrl` in `lib/site-config.ts`, path from `data-vault-source` — **needs a public repo**; clear `repoUrl` if it goes private), random note. `>` scopes to the current page; `>` alone prints the outline. The highlight is one sliding `.palette-marker`; no stagger on results. Three things open it: ⌘K and `/` (`Shortcuts`), the sidebar's search button, and the 404's search bar — that last one lives in `main`, outside `Chrome`, so it asks by an `opensearch` window event (`OPEN_SEARCH_EVENT`, exported from `components/NotFoundSearch.tsx`, listened for in `Chrome`) rather than by prop. Every dialog stays mounted with `data-open`, `inert` when closed, contents gated behind first open.

## Motion

`.stagger` (nth-child delays capped at 12, `animation: none` under reduced motion and print). `.page-in` fades navigations; the View Transitions API is used only by the lightbox. Grain: a fixed `feTurbulence` tile on `body::after`. Arrows lead on hover and stay thrown on press (`ArrowThrow.tsx` adds `.is-thrown`; `[`/`]` do the same); arrows are spans, never in a translated string. Checkmarks draw (`stroke-dasharray`, short arm first). Prose links sweep their underline with two gradients, scoped to `p/li/blockquote/td`. Pressed state: `docs/DESIGN-SYSTEM.md`. Removed and not to be rebuilt: drop cap, heading hairline, shelf parallax, page view-transitions, shelf edge fade and arrows.
