# Reading features

What runs while someone reads a note. Reasons: DECISIONS #12, #28–#30, #36, #39, #40, #42, #46–#49, #65, #76, #84, #85, #107, #108, #121, #127, #128.

## Progress and reader state

- **Reading time** (`readingStats()`) on posts only; the same `minutes` drives `ReadingProgress`'s "N min left" pill (bottom-right, quiet below 6% and above 97%; inside the breadcrumb bar below 640px).
- **Reading bar** (`lib/reading-progress.ts`, tested): text pays out continuously, media in one step at its bottom edge at `MEDIA_WEIGHT` (0.5). Read line = viewport top; finish = article end reaching the viewport bottom (`finishAt()`); a closing "Sources" heading ends the article. Measured in `measure()` with a `ResizeObserver` on `.prose`, eased (`EASE = 0.18`), one custom property `--p`, `contain: layout`. Anything drawn against the bar converts through `progressAt()`.
- **Read notes** (`lib/read-notes.ts`): finished at `READ_AT` (0.92), or on arrival for a note shorter than the viewport. A different store from reading position. `Series.tsx` reads it and each part has a checkbox (`markRead`/`unmarkRead`); the `noteread` event keeps readers in step.
- **Reading position** (`components/ReadingPosition.tsx`): offers to return, never scrolls on its own. One key, map of path → offset, pruned to 20 / 30 days, saved on a 400ms debounce, unmount and `pagehide`. Persist the last position the scroll handler saw, never a live `scrollY`; write nothing for a visit with no scroll (StrictMode). Dismiss on `wheel`/`touchmove`/scroll keys, not a threshold; decide after 250ms; offer only when the landing is more than half a screen from the mark and the URL has no hash. `?rp=debug` prints the gate values.
- **New badge** (`lib/new-notes.ts`, `components/NewBadge.tsx`): `chip` after a title (posts, projects, music, home, people), `cover` pill on shelf cards (`.cover-new`, opposite corner from `.shelf-status`, one rule block), `dot` on a spine. Not on `now`. Key `notes-seen` = `{prev, last}`; advances once per session (`SESSION_GAP_MS` 30 min), memoized per page; a note dated D arrives at the end of D and is compared to `prevAt`; `MAX_AGE_MS` 30 days; first visit badges nothing; `parse()` migrates the old day-string shape. Client-only, a component not a hook (`PostRows` is also a Suspense fallback). `.new-chip` and `.draft-chip` share one geometry rule; `vertical-align: 0.11em` is the placing; `.music-meta > span` and `.draft-chip-title` are the two exceptions.
- **Series** (`lib/series.ts`, `components/Series.tsx`): `series:` joins parts vault-wide by name (case/space-insensitive); "Part 2 of 5" badge beside the date opens a popover (mounted, `data-open`, `inert`, gated contents, nudged left by `offsetWidth`). Oldest first; `part:` overrides; `series_uk:` on any one part; single-part series render nothing; drafts count only in dev. Data pre-computed by `getSeries()` so the client never imports `lib/vault.ts`. The metadata row is a `<div>`. The badge never changes size.

## Contents rail

- From 1168px `components/Toc.tsx` is a rail on the right; below, the pill (`docs/CHROME.md`). Every row is one line, ellipsised, full text in `title`. `MIN_TOC_HEADINGS` = 3.
- **Scroll-spy** (`lib/toc-spy.ts`, tested): last heading above a line 140px down that descends to the window's foot over the final screenful; a page too short to scroll keeps the resting line. `held` pins a clicked heading.
- The highlight is one `.toc-marker` measured from the live DOM (first laid-out match). `.toc-outline` carries the hairline and `position: relative` and is the offsetParent for marker and rows. `Toc` takes an `above` slot (rail only, never the sheet) used by People notes; a shelf note renders the rail as the last child of its gutter column instead (`docs/SHELF.md`).

## Margins

- **Sidenotes**: `[^1]` renders as a `<span class="sidenote">` in the left margin from 1168px and as the bottom list below (both in the HTML). Only all-paragraph footnotes convert; one skip drops `all-sidenoted`. Ids carry the `uk-` prefix; the `footnote-label` heading is renamed per language and skipped by `rehypeHeadings`.
- **Pull-quotes**: `> [!pull]` becomes `<aside class="pullquote">` with the sidenotes' exact geometry (same `-14.5rem`, `clear: left`), in flow below 1168px; the title is the attribution, no generated title. Move the two gutters together.

## Previews, selection, lightbox

- **Link previews** (`lib/previews.ts`, `components/LinkPreview.tsx`): per page via `previewsInHtml()`; pointer only; `pointer-events: none`; flips above by anchoring `bottom`. The cover floats at its own ratio inside 80 × 84 (shrinks, never crops; remote covers fall back to 2:3 `contain`); nothing in the card may set `overflow` or `-webkit-box`; `EXCERPT_CHARS` = 140 bounds the height; a card without a cover is `fit-content` (13–20rem), with one takes the ceiling via `data-cover`.
- **Selection link** (`components/SelectionLink.tsx`): `#:~:text=` fragment, first and last five words for long selections, always `?lang=` (also `en`), pointer only. Does not translate.
- **Lightbox** (`components/Lightbox.tsx`): one gallery of the visible figures, rebuilt on every open from `offsetParent`; arrows bound only while open; inline diagrams re-rendered as markup under `#d-<name>-lightbox` with the figcaption as caption; below 640px arrows sit beside the counter; opens as a zoom via `lib/view-transition.ts` (`flushSync`, name moved not copied).
- **Copy as Markdown** (`components/CopyMarkdown.tsx`): the raw source in the active language; clipboard fallback in `lib/clipboard.ts`.
