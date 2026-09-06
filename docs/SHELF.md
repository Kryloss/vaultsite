# The shelf

Section type `shelf`: `vault/Shelf/` with `Books/`, `Movies/`, `Shows/`, `Videos/`, `Games/`. Code: `lib/shelf.ts`, `lib/shelf-creators.ts`, `lib/spine.ts`, `lib/siblings.ts`, `components/lists/`. Templates and portrait sourcing: `docs/CONTENT-WORKFLOW.md`. Reasons: DECISIONS #13, #22, #54, #86–#89, #110, #112–#115, #120, #126, #127, #133–#146.

## Frontmatter

| Key | Meaning |
|---|---|
| `author:` | Required. Book → Author, movie → Director, show → Creator, video → Channel, game → Studio; the role is derived from the medium, never written. `author_uk:`, `author_photo:` (in `vault/Shelf/creators/`, square-cropped to 320px before entering the vault), `author_bio:`/`author_bio_uk:` are optional and each degrades alone. |
| `medium:` | `book|movie|show|video|game`; omitted, the subfolder decides (`entryMedium()`). No other inference path. |
| `cover:` | Resolved by file name anywhere in the vault. Videos derive a thumbnail from `video:` instead. |
| `video:`, `uploaded:` | Video notes. `uploaded:` is the VIDEO's publish date and is what makes the page a `VideoObject`; without it the markup is deliberately not emitted. New videos: `docs/YOUTUBE-SHELF.md`. |
| `rating:` | 0–5, halves. His verdict, never invented. Rendered as the last fact row and as stars in Top lists. |
| `imdb_id:` / `imdb:` | Movies and shows only. The id is written by hand from Wikidata P345 — never guessed. `node scripts/imdb-ratings.mjs` refreshes `imdb:` (`--check` to dry-run). |
| `top_order:` | Manual Top-list position, written by the localhost drag editor. Authoritative over the derived order. Never renumber in content work. |
| `status:` | `reading`/`watching`/`current`/`in-progress` → a badge with the medium's verb (`STATUS_VERBS`); anything else means finished. |
| `categories:` | Multi-valued; chips on the medium page and `#tags` at the end of the entry's metadata line. |
| `spine:` | A photographed book spine (`vault/Shelf/Books/spines/`, vault-unique basename). A `<name>.uk.<ext>` sibling swaps with the language. |
| `coverFit: contain` | Letterbox wide art. Last resort; unused today. |

## Section page

One row per medium (`MEDIUM_ORDER`: video, movie, show, book, game), each heading linking to `/shelf/type/<medium>`. Strips are drag-to-scroll (`ShelfRow.tsx`), no edge fade, no arrows. Every strip is `--shelf-card-h` tall (190px, 170px below 480px) with widths derived via `.shelf-card-tall`/`.shelf-card-wide`; videos keep 16:9 at two thirds of that height rather than being cropped. Books are a row of standing spines (below). The section page shows no categories.

**Adding a medium** is four registrations in `lib/shelf.ts` — `MEDIUM_LABELS`, `MEDIUM_ORDER`, `CREATOR_ROLES`, `STATUS_VERBS` — plus one `ui` string. No component learns the word.

**Compact overview, rich detail**: the section page is a glance, the medium page shows the art. It shipped the other way round; read #110 before flipping it.

## Book spines

`components/lists/BookSpines.tsx`, `lib/spine.ts`, `scripts/dominant-colour.mjs`.

- The row scales to fit, never scrolls: `.book-slot` has an explicit shrink floor (70%, then it becomes a scroller), height is derived by `aspect-ratio` from `--spine-wn`/`--spine-hn` (unitless), `max-width: 100%` on `.book-spine` is load-bearing, the custom properties live on the slot, and the Ukrainian `aspect-ratio` is overridden beside the Ukrainian width.
- The pull under the heading is derived: `--shelf-lead` from the component, `.book-shelf-gap: calc(0.75rem - var(--shelf-lead) - var(--cover-reach))`.
- A photographed spine sets its own width from the photo's ratio (fractional, never rounded; per language via `--spine-w-uk`); height always comes from the COVER's ratio through `spineHeight()` (344–416px). Drawn text is `sr-only` with `alt=""`. Everything else is generated: ground from the cover's dominant colour, ink by measured contrast, no theme flip. `--spine-w` is 34px. All books are photographed; the generated spine is the fallback and is exercised only by `lib/spine.test.ts` and `scripts/dominant-colour.test.mjs` — not dead code.
- **Spine art is never `loading="lazy"`**: the hidden language never enters the viewport observer and stays empty after the toggle.
- Hover floats the book's face above it (`.book-spine-cover`, 6rem). It is `pointer-events: none`; its z-index sits on `.book-slot` (the stagger animation gives every slot a permanent stacking context); `@media (hover: none)` uses `display: none` so phones fetch no covers. `.book-spine` has `position: relative` and no `overflow: hidden`; the row carries `padding-top: var(--cover-reach)` and `.book-shelf-heading` is raised above it so the heading stays clickable.
- `status: reading` scales the book from its foot (`scale(1.045)`), never lifts it; hover lifts 8px. New is a `dot`; rating is not shown on spines.
- Import photos with `node scripts/import-spine.mjs <source> <slug>[.uk]` (or `<en> <slug> <ukSrc>` for a shared crop box). Non-zero exit means look at the file. Don't do it by hand.
- Two traps: never put `display` on the element carrying `.lang-*` (the flex is on `.book-spine-lines`), and the block sits below `.press` because the lift composes into the transform `.press:active` declares.
- Thickness from page count was built, measured and removed — don't rebuild (#110).

## Medium pages, Top lists, studios

- Medium pages are cover grids, except movies, shows and games open on a **Top list** (`ShelfTopList.tsx`; `hasTopList()` is the one predicate). Only the unfiltered view; a category chip opens the grid. Rows: rank, 44px cover, title, description, stars, and for films/shows the IMDb number with a small `IMDb` label.
- **Two verdicts, never merged**: stars are his `rating:`, the number is IMDb's. Never draw IMDb as stars. `sortForTop()`: rated first, then the tail by IMDb/date/title; `top_order:` overrides when present. A game row has no IMDb column.
- **Studios** (`lib/shelf-creators.ts`, games only via `hasCreatorPages()`): a game's creator block links to `/shelf/type/games/<studio>`, a category page whose facet is the creator (same route, chips, view). A `Studios` chip beside `Top` opens the index — a ranked list of people (by how many games, a count, never stars), never covers. Inside studio mode the chips are `Top`, the door (`Categories`, never lit), then the studios alphabetically. A studio slug that collides with a category is dropped, not suffixed. Combining facets is not built. `Creator` takes an optional `href`; the portrait link is `aria-hidden` with `tabIndex -1`; the bio never links.
- **Chip row** (`.filter-chips`): two flex rows scrolling sideways, split at `Math.ceil(chips.length / 2)` in `ShelfTypeView.tsx` (not a grid — a grid aligns columns and left holes). The stack is `width: max-content`; `.filter-chip` is `white-space: nowrap; flex: none` with a pinned line-height. `ChipRowScroll.tsx` brings the lit chip into view with `scrollTop` (never `scrollIntoView`); the box keeps `position: relative`.
- Breadcrumb reads "Kyrylo · Shelf" on every shelf page.

## Entry page

- **Creator block** (`components/Creator.tsx`, `entryCreator()`): round portrait, role, name, bio, above the body. Initials fallback = first + LAST word, `|` and after dropped; every creator has a portrait today, so the fallback is exercised only by tests — keep it. The fact table must not repeat the author. A game's `author:` is the studio and its portrait is the studio's YouTube avatar — resolve the channel by id, never guess the handle, then look at the file (`docs/CONTENT-WORKFLOW.md` step 6). Named exceptions to the Commons rule: #146.
- **Fact table**: on shelf and music entries a table whose header cells are all empty renders as plain rows (`RenderOptions.factTables`, gated by `opensWithHeaderBlock()` together with the creator block — one predicate, on purpose). Label column `--fact-label: 8rem`, `table-layout: fixed`; the portrait is 6rem + 2rem gap so its text starts on the same line. `rating:` is appended as the last row. Below 480px label and value run on as one line and the creator's bio drops full-width (grid + `display: contents`, `row-gap: 0`). People notes keep the card — leave them. The empty `<thead>` is deleted in the pipeline here and hidden by CSS everywhere else; keep that CSS rule.
- **`## At a glance` stays in the markdown** and is clipped by CSS (`fact-heading`), never deleted and never `display: none`: it holds the outline row, the `#at-a-glance` anchor and the scroll-spy measurement. Deleting it dropped half the shelf under `MIN_TOC_HEADINGS`.
- **Gutter column from 1168px** (`.note-gutter[data-column]`, set by the page — never `:has(.note-cover)`): cover (`NoteCover.tsx`, 13rem, own ratio, `top: 5rem`, `left: calc(50% + 20.5rem)`), creator as a caption (role and name beside the face, bio below), facts label-over-value, then the contents rail as the last child. The wrapper is `display: contents` below 1168px, the rail is `position: relative` inside it, and `.note-gutter > :first-child { margin-top: 0 }`. Every medium but video shows artwork there; a video takes the column without it. The fact table is lifted out of the article by `rehypeLiftFacts` (`RenderOptions.liftFacts`) and rendered as `<div class="prose note-facts mt-8">` inside the wrapper; the heading is not lifted. `--note-cover-h` no longer exists.
- **Thumbnail below 1168px** (`.note-thumb`): the artwork sits left of the `<h1>`, out of flow — `position: absolute; top: 0; left: 0; height: 100%; width: auto; max-width: var(--note-thumb-w)` (6rem, a ceiling). `width: auto` with a definite height is the height→width transfer; `top` + `bottom` is not. The ratio is `width`/`height` attributes (`1000` × `coverAr`), not CSS. The title's offset is measured into `--note-thumb-fit` by `lib/note-thumb.ts` (inline script after the header + `NoteThumbFit.tsx` with a `ResizeObserver`); the fallback is the full reserve. `.copy-md` hangs off `.note-header`'s left edge and is hidden between 640 and 768px. Don't rebuild a stretched crop, a grid-track derivation, or a `min-height` floor (#128–#134).
- **Footer arrows** walk the note's own medium (`siblingPool()`); medium-less notes are each other's neighbours. Tested in `lib/siblings.test.ts`.

## Cards

Card artwork is `position: absolute; inset: 0`. Covers carry `srcset` via `coverSrcSet`. The New mark on a card is the `cover` shape, opposite corner from the status badge (`docs/READING.md`). OG cards: `docs/SEO.md`.
