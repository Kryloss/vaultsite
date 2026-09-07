# Sections, entries and frontmatter

The vault model and the per-section conventions that are not visible from `lib/vault.ts`. Content intake templates: `docs/CONTENT-WORKFLOW.md`. Adding a section TYPE: `docs/ADDING-PAGE-TYPES.md`. Reasons: `docs/DECISIONS.md` #2, #5, #14, #20, #24–#27, #42, #64, #65, #111, #125, #126.

## The vault model

- TOP-LEVEL folders of `vault/` → section pages, `.md` files inside them → entries with their own URLs. A top-level folder + `main.md` = section; other `.md` = entries, at any depth inside it. Breaking these breaks the owner's Obsidian workflow.
- Sections may hold subfolders (`vault/Shelf/Books/`, `vault/Shelf/Books/covers/`, `vault/Posts/attachments/`) — they're filing, for the owner's benefit in Obsidian. A subfolder never becomes a page and never appears in a URL: an entry's slug comes from its file name, so a note can move between folders without breaking its address (#27). The one exception to "means nothing": a shelf note with no `medium:` inherits it from its folder (`entryMedium()`); do not invent another inference path.
- Slugs: `slugify()` in `lib/vault.ts` — keep stable, changing it breaks URLs. Entry sort has a title tiebreak on equal dates so `readdir()` order never leaks into the Cmd+K index.
- Home is the section whose slug is `home` (`app/page.tsx`); `lib/section-types.tsx` is the registry mapping a section `type` to its list component. A section's `main.md` PROSE is normally printed by `app/[section]/page.tsx` above the list; a type listed in `bodyBelow` there (music only) receives it as the `body` prop and places it itself — the page still renders the markdown and hands down ONE node, so the `.lang-en`/`.lang-uk` pair is never split (#111).
- The mascot (`components/Mascot.tsx`, `lib/mascot.ts`, #158, #159) is BUILT AND PARKED: nothing on the site renders it. Read those two entries before wiring it anywhere — they carry the sizes, the tokens, what a placement costs, and the four places it has already been tried and taken out again.
- **Drafts**: `draft: true` (or `published: false`) entries/sections are visible in `npm run dev` with an amber "Draft" badge, excluded from production builds (`SHOW_DRAFTS` in `lib/vault.ts`). `Post Sample` and `Draft example` are scaffolding and stay draft; `Formatting playground` is published on purpose (#70).
- Assets: never reference vault files directly from components — they're mirrored to `public/vault-assets/` by `scripts/sync-assets.mjs` (runs via predev/prebuild). `resolveCoverUrl()` resolves `cover: sapiens.jpg` like an image embed does — the note's own folder first, then vault-wide by file name — and `entry.sectionDir` carries the note's real folder.

## Frontmatter

- Section `main.md`: `title`, `title_uk`, `description`, `description_uk`, `icon`, `order`, `type`, `slug` (override), `draft`. Full frontmatter is exposed as `section.meta` so section types can define their own keys (`music` reads `playlists:` and `artists:`; `now` reads `updated:`/`updated_uk:`, `resume_file:`).
- Entries: `title`, `title_uk`, `date` (YYYY-MM-DD), `description`, `description_uk` (exposed as `Entry.descriptionUk`), `slug`, `draft` (or `published: false`), `series` (+ optional `series_uk`, `part`), `aliases:`, `category:`/`categories:`, `cover:` (people, shelf and music), `maturity:` (posts; anything unset falls back to seedling, #24). Shelf keys: `docs/SHELF.md`. Music keys: `docs/MUSIC.md`. Entry frontmatter is exposed as `entry.meta` (same pattern as `section.meta`) for type-specific keys.
- Section bodies use a sibling `main.uk.md` and entry bodies a sibling `<name>.uk.md`, body only.

## Posts (`posts`, the default type)

- Category filter chips from entry `category:` frontmatter — chips are links to `/posts?category=X`, read by `useSearchParams()` in `PostListClient`, so a post's own category chip lands here pre-filtered. Unlike the shelf these are NOT separate pages: no per-category title/OG/sitemap entry, and filtering needs JS; the Suspense fallback renders the full unfiltered list into the static HTML (#14). The owner asked specifically not to add pages for these.
- The list groups entries by year (empty years never render); row dates are DD.MM. This date treatment is posts-only — other types show full dates.
- Filterable lists are split server/client: `PostList`→`PostListClient` (server slims entries to serializable rows). A server component RENDERED BY a client one still ships to the browser and so cannot import `lib/vault.ts` — `components/lists/PostRows.tsx` is the example, and `lib/dates.ts` and `lib/categories.ts` exist because of it (#15).
- Reading time and the reading bar are posts-only (`docs/READING.md`). One metadata line under the title: date · reading time · words · maturity · series, then the `#tags` — pieces collected into an array and joined, never hand-written separators (#66).

## Projects (`projects`)

TIL-style inline feed; async list component. The list truncates entries over 1000 markdown chars; "Continue reading" links to the entry's own page. Each entry's headings are prefixed with its own slug (#17), and its Ukrainian body takes `uk-<slug>-` on top of that — both bodies ship in the one document, `.lang-en`/`.lang-uk`, the way an entry page does it. **The two bodies cut at the same block**, decided on the English one by `lib/til-preview.ts` (#160) — a per-language character budget dropped a whole block from the Ukrainian preview, because the same words run longer in Cyrillic. "Continue reading" still belongs INSIDE the language wrapper, not beside it: a translation that ends before the shared cut is showing everything and has nothing to link to. A note with no `.uk.md` sibling keeps showing its English body in either language.

## People (`people`)

`components/lists/PeopleCards.tsx` (#125). Two compositions, both two to a row at every width — the grid never changes, only a cell's contents:

- From 640px: a 280px row card, the square portrait (140px) beside a `--surface` panel overlapping its inner edge with the name (0.9375rem) and the note's `description:` (0.8125rem, clamped at four lines as a safety valve). The panel needs `position: relative` + a z-index or the portrait paints over it.
- Below 640px: the portrait fills the card and the panel is a small opaque name card in its top-right corner (`max-width`, halved insets and radius). The description is hidden with `display: none` on `.person-card-role`, never on the `.lang-*` spans.
- Never widen the list past `--measure` (tried and reverted; the deck earns it, this list does not). The panel shows name and description only — `personBlurb()` was deleted, don't bring it back. New is the `chip` shape. Portraits are full colour at rest; `.person-photo` is gone.

**A People note** shows its portrait and its "At a glance" block at the HEAD of the contents rail via `Toc`'s `above` slot (rail only, never the sheet; #121, #128, #129). The rail's hairline lives on `.toc-outline`, and `.toc-portrait ~ .toc-outline` carries the separating margin and a `margin-left: 0.75rem` so the column has one left edge. The fact block is rendered twice (article and rail) and `.page:has(.toc-facts) .note-facts` hides the article's copy from 1168px; the rail copy is outside `.prose` and stacked label over value. Below `MIN_TOC_HEADINGS` the portrait renders as `.note-portrait` in the rail's place. The phone gets the same `.note-thumb` as the shelf. The fact table keeps its card (`.person-facts`: tertiary labels, `--text` values, tighter rows) — don't convert it to the plain list. Portraits: Wikimedia Commons only, license noted; named exceptions in #146.

## Now (`now`)

A nownownow-style page: a "Short-term goals" checklist plus an optional résumé, both written as MARKDOWN IN THE BODY and parsed by `lib/now-content.ts` into the `goals`/`resume` shapes the components read — `## Goals` is a task list (`[x]` = done, indented bullet = sub-label, trailing `→ [[Note]]` = link), `## Résumé` is a summary paragraph + one `###` per block + one `#### Role · Org` per timeline row with `*period* · sub-label #current` on that same line. Frontmatter keeps flat keys only. Ukrainian goes in a sibling `main.uk.md` with the same structure, merged by position; flags and links are read from `main.md`. Anything above the first heading renders as intro prose. Parsing is forgiving on purpose — an unrecognized heading warns and never throws (#26). `now` mounts no New badge (#84) and has no entries, so no nav tree.

**Résumé** (`components/Resume.tsx`): bullet strings use a `Label — detail` convention and the em dash splits the bold lead-in. `scripts/build-resume-pdf.py` renders the downloadable PDF from that same section, with its own English-only copy of the parser (run by hand — deliberately not in `prebuild`; `pip install weasyprint` alone does NOT work, and the Lato fallback silently costs a second page — the exact command and the three traps are in the script's own docstring). The PDF is public, so it carries email + city only — **no phone number or street address anywhere in the repo** (#25). Its block list is defined once in `lib/resume.ts` and shared by the component, the Now page's `<Toc>` outline, and Cmd+K search (a dedicated "Résumé" result plus one per block). `/resume` redirects to `/now` (`next.config.ts`).

## Entry pages, all sections

- Breadcrumb, `<h1>`, metadata line, then for shelf and music the creator block and fact list (`docs/SHELF.md`). A `[!pull]` and footnotes: `docs/READING.md`.
- **Entry footer arrows** (`lib/siblings.ts`, `components/EntryFooter.tsx`, #20, #126): `‹ prev / next ›` is the section's own list, one step either way, a single row with a chevron at each edge — except on the shelf, where the pool is the note's own medium. Related-by-category was built and removed the same day.
- **Series**: `docs/READING.md`.
- The "← Section" link above the title was removed (#61) — the floating breadcrumb already names the section.

## Planned / future (do not build unless asked)

- Supabase for dynamic features (post views, reactions, AMA). Deliberately not used for content — see `docs/DECISIONS.md` #1.
- More section types (stack, TIL).
- Written-up plans for work not yet started live in `docs/plans/` (transient — deleted once the work ships and its reasoning moves to `docs/DECISIONS.md`). Currently empty.
