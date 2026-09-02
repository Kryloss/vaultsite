# AGENTS.md — Codex project guidance

Instructions for Codex and other agents working on Vaultsite. This file applies
to the whole repository.

## Start here

1. Read this file before doing any work.
2. Read `docs/ARCHITECTURE.md` before changing code or site structure.
3. Check `git status --short` before editing. Preserve unrelated and in-progress
   user changes; never discard, overwrite, or reformat them as collateral work.
4. Read only the task-relevant deeper guidance:
   - Content intake or vault edits → `docs/CONTENT-WORKFLOW.md`
   - New section/list type → `docs/ADDING-PAGE-TYPES.md`
   - Excalidraw or diagrams → `docs/EXCALIDRAW.md`
   - A YouTube video reaching the shelf → `docs/YOUTUBE-SHELF.md`
   - Existing architectural/design behavior → search `docs/DECISIONS.md`
   - Detailed feature inventory → search the relevant section of `CLAUDE.md`

`CLAUDE.md` is the expanded, tool-neutral project reference originally written
for Claude. Codex must treat it as repository documentation, not as instructions
for a different project. Search it before modifying an existing feature, but use
this smaller file as the always-loaded map. Code and the targeted decision record
remain the source of truth if prose has drifted.

## Two agents work on this repo

Claude Code and Codex are both used here, on the same checkout. Each auto-loads
its own file: Codex reads this one, Claude Code reads `CLAUDE.md`, and `docs/` is
shared and authoritative for both.

- **`CLAUDE.md` owns feature detail; this file owns the map.** Do not restate
  feature detail here — point at `CLAUDE.md` instead. Duplicated prose is what
  drifts.
- **Change a convention, command, or invariant → update BOTH agent files in the
  same change**, plus `docs/DECISIONS.md` when the choice is non-obvious. The two
  files have already drifted apart once (each described a different `npm test`
  wiring), which is exactly the failure this rule prevents.
- **One agent at a time in this working tree.** Obsidian Git auto-commits
  *everything* (`autoCommitOnlyStaged: false`) every 10 minutes and pushes, and
  Vercel deploys the result — so a half-finished edit publishes itself on a
  timer. Finish and verify a change, or work in a separate `git worktree`. Do not
  run Codex and Claude against this checkout at the same time.
- **Check `git status --short` before editing.** Uncommitted changes you do not
  recognise may be the other agent's or the owner's in-flight work: leave them
  alone and ask. Never `git restore`, `git checkout --`, or `git stash` a file you
  did not change yourself.

## What this project is

Kyrylo's personal portfolio, published directly from an Obsidian vault. The
`vault/` directory is the CMS:

- A top-level folder containing `main.md` is a section and gets a section URL.
- Any other `.md` file beneath that section is an entry with its own URL.
- Subfolders are for Obsidian filing only. They never become URL segments.
- Git is the source of truth: Obsidian Git → GitHub → Vercel.
- The deployed site is fully static. Content is read only at build time.
- `npm run dev` additionally starts the localhost-only authoring sidecar
  documented in `CLAUDE.md` and DECISIONS #118/#122; it is never part of a build or
  production server. Its in-page editor owns only the current source's
  title/description and exact EN/UK Markdown bodies; generated/external text is
  read-only. While its dock is open, contextual page controls can create
  bilingual Draft entries, edit Draft/category/Post-series metadata, and toggle
  paired Now goals. Production webpack aliases must replace both the dock and
  those contextual server slots; a development branch around a dynamic import
  does not by itself keep the client island out of public bundles. Attachments
  remain an Obsidian operation.

The owner is a high-school student rather than a professional developer. Prefer
simple, documented, low-maintenance solutions over clever abstractions.

## Non-negotiable rules

1. Never edit site content outside `vault/` unless the user explicitly asks.
2. Keep content fully static: no runtime filesystem reads, content database, or
   server actions. Dynamic routes resolve at build time with
   `generateStaticParams`; `dynamicParams = false` remains intact.
3. Keep the vault model stable: top-level folder + `main.md` = section; all
   other markdown beneath it = entries. An entry slug comes from its filename
   (or explicit frontmatter override), never its subfolder path.
4. Do not change `slugify()` semantics casually. Existing URLs depend on them.
5. Never reference vault assets directly from components. `predev`/`prebuild`
   runs `scripts/sync-assets.mjs`, which mirrors them to
   `public/vault-assets/` and generates image metadata/variants.
6. Update `docs/DECISIONS.md` for a non-obvious architectural decision. Update
   the relevant user/AI docs when conventions or frontmatter change.
7. Any new UI must work in English and Ukrainian, light and dark color schemes,
   and `prefers-reduced-motion`.
8. Do not add a manual theme switch, an accent color, or a second typeface.
9. Do not build items under “Planned / future” unless the user asks for them.
10. Do not commit, push, deploy, or add dependencies unless the user requests
    that action or it is clearly part of their stated task.

## Repository map

| Path | Responsibility |
|---|---|
| `vault/` | Obsidian-authored content and its source media |
| `app/` | Next.js App Router routes, metadata routes, and global CSS |
| `components/Page.tsx` | The only page shell; owns measure, gutters, and rhythm |
| `components/Chrome.tsx` | Drawer, breadcrumb, global chrome, and page wrapper |
| `components/lists/` | Section-specific list renderers |
| `lib/vault.ts` | Section/entry discovery, slugs, frontmatter, sorting, indexes |
| `lib/markdown.ts` | Obsidian preprocessing and Markdown-to-HTML pipeline |
| `lib/section-types.tsx` | Section `type` → list component registry (+ `listRendersBody`, which types place `main.md`'s prose themselves) |
| `lib/ui-strings.ts` | Fixed English/Ukrainian UI strings |
| `lib/observances.ts` | Ukrainian national days the sidebar counter steps aside for, and their kind |
| `lib/plural.ts` | Counted nouns — any string with a number in it |
| `lib/dates.ts` | Date formatting with no `fs` behind it, safe for client code |
| `lib/metadata.ts`, `lib/jsonld.ts` | Canonicals, Open Graph, and structured data |
| `lib/og.tsx` | Shared build-time link-cover renderer and artwork fallbacks |
| `scripts/sync-assets.mjs` | Build-time vault asset mirror and image manifest |
| `docs/ARCHITECTURE.md` | Stable system and design-system overview |
| `docs/DECISIONS.md` | Reasons and invariants behind non-obvious behavior |

Routes:

- `app/page.tsx` renders the section whose slug is `home`.
- `app/[section]/page.tsx` renders section pages.
- `app/[section]/[slug]/page.tsx` renders entry pages.
- Shelf medium/category routes are special filtered views documented in
  `CLAUDE.md` and `lib/shelf.ts`. The SECTION page's books row is a shelf of
  standing spines; a medium page is a grid of full-size covers — compact
  overview, rich detail — except movies and shows, which open on a ranked
  `Top` list instead of an `All` grid (`hasTopList()`/`sortForTop()`,
  DECISIONS #113). Category chips still open the grid everywhere. That list
  shows TWO ratings and never merges them (DECISIONS #114): stars are
  Kyrylo's `rating:`, the labelled number is IMDb's `imdb:`. Never draw
  IMDb's average as stars. `imdb_id:` is written by hand, once; `imdb:` is
  refreshed by `node scripts/imdb-ratings.mjs` (`--check` to dry-run) and
  lives in the vault rather than being fetched at build. In localhost editing,
  dragged rows persist consecutive `top_order:` values; those manual positions
  take precedence over the derived rating/IMDb/date fallback. A movie/show ENTRY
  page also parks its poster in the right gutter from 1400px, reusing the
  music player's geometry (`components/NoteCover.tsx`, DECISIONS #115), and
  the creator block and the fact list join it under the poster there — one
  fixed `.note-gutter` column, unless the note has a contents rail, which wants
  the same column. The fact table is LIFTED out of the article to get there
  (`liftFacts` in lib/markdown.ts) and renders in the same place as before at
  every narrower width. On
  a PHONE any shelf note with a cover (a book too, never a video) shows it
  small to the LEFT of its title instead (DECISIONS #120). A PEOPLE note shows
  its portrait AND its "At a glance" block at the foot of the contents rail
  (`Toc`'s `below` slot, rail only; the block is rendered twice and CSS shows
  one) and gets the same phone thumbnail (DECISIONS #121).
  The books row SCALES TO FIT its column rather than scrolling, so spine
  height is derived via `aspect-ratio` (DECISIONS #112). A note with `spine:` shows a
  photograph of the real spine at its true thickness, with a
  `<name>.uk.<ext>` sibling swapping by language; the rest are generated from
  the cover's dominant colour (`components/lists/BookSpines.tsx`,
  DECISIONS #110). Bilingual IMAGES that swap by CSS must not be
  `loading="lazy"` — the hidden one never loads.

## Working agreements for code changes

- Keep TypeScript strict and use the `@/*` alias for repository-root imports.
- Reuse current patterns before introducing a new helper, abstraction, package,
  client component, or state store.
- Preserve server rendering. Add `"use client"` only when browser state or an
  event handler requires it; keep the client boundary thin. Note that a server
  component RENDERED BY a client one still ships to the browser and so cannot
  import `lib/vault.ts` — `components/lists/PostRows.tsx` is the example, and
  `lib/dates.ts` exists because of it.
- All routes use `<Page>`. Never duplicate its container utilities.
- Use existing CSS tokens instead of literal colors, radii, motion durations,
  page widths, or gutters.
- Interactive controls opt into `.press`; card-sized controls use
  `.press.press-soft`. Do not add `transition-colors` beside `.press` because
  `.press` owns the transition.
- `app/globals.css` has no `@layer`; source order is the tie-breaker. Put an
  override below the rule it overrides. Keep the named `.press` integration
  block at the very end because earlier `transition:` shorthands reset
  transforms.
- Use Source Serif 4 for everything except code. It is self-hosted with the
  Cyrillic subset and the `opsz` axis.
- Use `components/T.tsx` plus `lib/ui-strings.ts` for fixed bilingual UI. Do not
  hard-code a new English-only interface string. Any string containing a COUNT
  goes through `lib/plural.ts` instead — English has two forms and Ukrainian
  three, and interpolating a bare number ships a phrase with no noun in it,
  which an English reader will never notice.
- Keep the design monochrome. State emphasis uses `--text`; there is no
  `--accent` token. Existing semantic callout colors and documented hover-only
  brand/photo exceptions may remain, as does the sidebar's flag-coloured line
  on Ukrainian CELEBRATION days (`--ua-blue`/`--ua-yellow`, `.observance`,
  `lib/observances.ts`, DECISIONS #104). Those two tokens belong to that one
  line on eight days a year — do not reuse them as an accent. Days of
  REMEMBRANCE deliberately get no flag: `.observance-quiet` keeps them
  monochrome, and that distinction is not a detail to tidy away.
- Respect accessibility patterns already present: semantic controls, keyboard
  behavior, focus management/restoration, `inert` for closed dialogs, reduced
  motion, and usable touch states.

## Content model and intake

For any raw post, shelf note, person, project update, music note, or Now update,
read and follow `docs/CONTENT-WORKFLOW.md` completely before editing.

Core contract:

- Light-touch edits only: fix grammar, typos, and structure without replacing
  Kyrylo's voice, opinions, or jokes.
- Ask only about genuine ambiguity; batch necessary questions and otherwise use
  documented defaults.
- Publish directly unless the user asks for a draft.
- Add useful Obsidian wiki links. New notes get natural `aliases:` values; scan
  existing notes for exact mentions and retro-link without changing wording.
- Every new/updated content note must be complete in both languages:
  `title_uk:` in English frontmatter and a full sibling `.uk.md` body with the
  same structure, links, and embeds.
- Factual People/current-event notes end with 2–4 sources used for verification.
  Opinion, shelf, and music notes do not need a sources section — but a shelf
  note's `author_bio:` is still a factual claim: verify it or omit the key.
- Source images using the workflow's approved sources and licensing rules.
  Never use random image results or AI portraits of real people. Ask once before
  downloading a batch; use a remote cover URL only as fallback.
- Reuse existing categories; ask before inventing a new category or series.
- Validate frontmatter and report the written path, future URL, links, media
  sources, fixes, and assumptions.

Important conventions:

- Section `main.md`: `title`, `icon`, `order`, `description`, `type`, optional
  `slug`, optional `draft`; the complete frontmatter is exposed as
  `section.meta`.
- Entry: `title`, `date`, `description`, optional `description_uk`, optional
  `slug`, optional `draft` (or `published: false`), optional
  `series`/`series_uk`/`part`; complete frontmatter is exposed as `entry.meta`.
- Section body translations use `main.uk.md`; entry translations use
  `<name>.uk.md`, body only.
- Section links use `[[Folder/main|Label]]`. Bare section names can create the
  wrong Obsidian note.
- Shelf notes go in the matching `Books/`, `Movies/`, `Shows/`, or `Videos/`
  subfolder. Those folders still do not affect URLs.
- Shelf `medium` may be explicit or inferred by `entryMedium()` from the filing
  folder. Do not invent another inference path.
- Shelf entry pages open with a creator block (portrait, role, name, bio) built
  from `author:` plus `author_uk`/`author_photo`/`author_bio`/`author_bio_uk`.
  The role comes from `medium:` — there is no `role:` key — and the note's
  fact table must not repeat the name in a row of its own. Portraits
  live in `vault/Shelf/creators/`. Sourcing a portrait is a multi-step cascade
  ending in the channel's own YouTube avatar for video notes — do not stop at
  one failed lookup. Detail in `CLAUDE.md` and `docs/CONTENT-WORKFLOW.md`;
  reasons in `docs/DECISIONS.md` #86.
- The `music` section page is a COVER DECK, not a list of artists: the notes'
  album art raked away from a centred card (`components/Coverflow.tsx`). The
  ARTIST — portrait, name, two lines of bio — heads the deck ABOVE the covers,
  following whichever one is centred; the record's title, description and its
  own "At a glance" rows print below it. It replaced twenty-six stacked
  artist cards and a 7,137px page. Notes are still GROUPED BY ARTIST —
  `groupByArtist()` sets the order and `flattenGroups()` only unrolls it, so an
  artist's records stay adjacent; never re-sort the deck by date. The caption's
  fact rows are lifted from the note's own markdown table
  (`lib/music-facts.ts`) and merged EN/UK BY POSITION, because `date:` is when
  the note was written and not when the record came out. Cards are real links
  and fall back to a plain wrapped grid before hydration and with no JS; an
  off-centre card centres rather than opens (`cursor: pointer` plus a veil on
  `.cf-card::after` is what makes that discoverable — never a transform, and
  never `.press`, since `paint()` owns the cards' `transform`).
  There are NO pagination dots. **`.cf-stage` must keep `pointer-events: none`
  and `.cf-card` `pointer-events: auto`**: under `preserve-3d` the stage's own
  box sits at z = 0 in the children's 3D space, and every card but the centred
  one is pushed behind it, so without this the stage swallows every press aimed
  at an off-centre cover and click-to-centre cannot fire at all. That was the
  actual cause of the bug below, and it also kept the hover veil from appearing.
  **WEBKIT ignores that fix and hit-tests none of the raked cards** — only the
  centred one — so the press is resolved from the cards' own boxes instead
  (`cardAtPoint()` in `lib/coverflow.ts`, used only when the browser names no
  card), and the hover veil is marked with `data-cf-hover` for the same
  reason. Verify anything touching this in WebKit, not only in Chromium.
  Click-to-centre is otherwise decided on `pointerup`, in
  the frame, from `data-cf-index` in the DOM — never in the click handler,
  which is only a gate. Three rounds of fixes failed before that; don't move
  the decision back. The five JS traps, all still real: a mouse press focuses
  the link first, so
  focus must centre only on `:focus-visible`; `endDrag` must not settle on a
  press that never moved; the centre must be read from `centredRef`, never
  `selected` or `targetRef`; `onPointerMove` must ignore movement under
  `DRAG_SLOP`; and the tap-vs-drag test is on the OUTCOME (`TAP_TRAVEL`, a
  fifth of a card of actual deck travel), never on how far the hand moved.
  Card artwork is `position: absolute; inset: 0` so no card background can show
  under it at fractional zoom. **The recession is painted on the ARTWORK, never
  on the card**: `paint()` writes it to `--cf-fade`, which `.cf-card img` takes
  as its `opacity` and which scales the box-shadow, over an opaque `--bg`
  ground. Putting it on the card's own `opacity` made every cover a
  translucent sheet you could see the next one through. Element `opacity` is
  the teleport fade only. The toolbar's one-line rule is a 639px query
  because the search field's intrinsic width, not the window, is what wrapped
  the heading. **NOTHING ON THE PAGE MAY CHANGE HEIGHT**: the artist bio is
  shown in full in a slot sized by hidden copies of every other bio
  (`.artist-bio-slot`), the description is two lines, the fact list three rows
  (so `MAX_FACTS` is 3 — that cap and the CSS reservation are one decision),
  and fact values are one line ellipsised. The caption's floor is derived from
  the type in `--cf-caption-h`; re-derive rather than nudge. The COVERS may
  exceed `--measure`; the artist block may not — it is prose and sits in the
  36rem page column. The artist's portrait sits in the MIDDLE of the TOOLBAR
  row at every width (the block below has no picture), which is why that row is
  a three-column grid and not a flex row; below 640px the heading is
  screen-reader-only and the cheeks hold the search and the language button —
  both at `width: 5.5rem`, one size, one at each end of the row. 88px less its
  padding and hairline is 64px of content, which is why `ui.musicSearch` is
  one word (`Search…` / `Пошук…`); the full sentence lives on the aria-label.
  Every toolbar item must name its `grid-row` — auto-placement drops the search
  to a second row otherwise (rendered twice, shown once, `display: none` on the
  other so it is never fetched); `Coverflow`'s `onSelect` is what lets chrome
  outside the deck follow the centred cover. An artist's general description
  lives in the section's `main.md` (`artists:`); a note's `artist_bio:` is
  about that record. The two are different texts on purpose. A music NOTE opens
  like a shelf note — an artist block from `artist:` plus a plain fact list —
  and tints its own opening with its own cover, window-wide and dissolving
  rather than framed; the SECTION page has no wash any more, since a deck of
  full-size covers is already the colour. The Apple Music embeds carry no
  footer link of ours (#92). Detail in `CLAUDE.md`; reasons in
  `docs/DECISIONS.md` #90, #103 and #123.
- The `/music` deck is FILTERABLE: a search box plus ONE language button that
  CYCLES All → ENG → UA → RU on press, showing the current step — both on the
  heading's line, at every width, with the heading wrapping instead. Notes carry
  `lang:` (`en`/`uk`/`ru`, or a list), which is the SHELF a record belongs on
  rather than strictly what it is sung in — Нервы sing in Russian and are `uk`;
  BLIND8 are Ukrainian and are `en`. Don't "fix" it from the lyrics. Notes also
  carry `genres:` (Apple's genre split on the slash); these are SEARCH TERMS,
  not filters and not chips, and each artist is auto-tagged at build time with
  the union of their notes' genres so "rap" returns rap artists. Search is the
  Cmd+K palette's two passes — literal word-prefix, then a labelled trigram
  fallback; the controls narrow the deck, and a new set of cards opens on its
  own first card. The list half is a client
  component (`components/lists/MusicNotes.tsx`), so the pure shapes and the
  filter live in `lib/music-filter.ts`, which must never import `fs` — the same
  split, for the same reason, as `lib/dates.ts` against `lib/vault.ts`. The
  button's label is painted in the flag's colours while RU is selected, the ONE
  place outside the sidebar's national days those colours appear; see
  `docs/DECISIONS.md` #117 before adding a second.
- `draft: true` content appears in development and is excluded in production.

## Feature invariants worth checking before edits

- Markdown supports wiki links/embeds, relative images, callouts, progress
  fields, GFM, syntax highlighting, figures, footnotes/sidenotes, Apple Music,
  YouTube, and self-theming SVGs. On SHELF AND MUSIC ENTRY PAGES ONLY, a table with
  all-empty header cells renders as a plain fact list rather than a card.
  Its `## At a glance` heading is kept in the markdown but clipped by CSS on
  EVERY section, so it survives in the table of contents — do not delete it
  from a note. People notes keep the card and only lose the painted heading.
  See `docs/DECISIONS.md` #87. Extend the existing build-time pipeline rather
  than adding client-side Markdown/highlighting work.
- English and Ukrainian share routes. The selected language is client-persisted
  and restored before paint; translated bodies render as paired language blocks.
- Search is a static `/search-index.json` fetched on first palette open. Heading
  anchors use `github-slugger`, which preserves usable Ukrainian anchors.
- Canonical metadata is required because `?lang=uk` is an indexable duplicate
  without it. Use `pageMeta()` and preserve JSON-LD, sitemap, RSS, and OG-image
  behavior when adding routes or content types.
- Shared-link covers are editorial vault cards generated by `lib/og.tsx`. Keep
  their embedded Source Serif font bytes, monochrome mark and title fingerprint,
  artwork-only colour, shape-aware `contain` mounts, and quiet text-card
  fallback together; details and rationale are in `CLAUDE.md` and DECISIONS
  #106.
- Reading progress, read-note state, reading position, series state, the "New
  since your last visit" badge, keyboard shortcuts, link previews, selection
  links, lightbox behavior, and command palette actions are separate features
  with documented invariants. Search `CLAUDE.md`, their implementation, tests,
  and matching decision records before changing any of them.
- Reader-state signals are CLIENT-ONLY and must start hidden: the site is
  static, so anything derived from localStorage renders after hydration or it
  mismatches. `components/NewBadge.tsx` is a component rather than a hook for
  this reason — `components/lists/PostRows.tsx` and `PeopleCards.tsx` also
  render on the server as Suspense fallbacks, and a hook there would empty the
  static HTML. It renders in every section list except `now`, in one of two
  shapes: a chip after a title in text rows, a mark on the cover of a shelf or
  people card, or a dot at the head of a book spine. A new section type that
  lists ARRIVALS should mount it; a page about the present should not.
- Self-theming SVG diagrams are deliberately inlined; do not replace them with
  ordinary `<img>` output. Excalidraw JSON is not shipped.
- Image notes pair a bilingual SVG/Excalidraw embed with an original photo via
  `<!-- image-note: file -->`; preserve the static, diagram-first radio switch
  and its shared dimensioned stage, and strip EXIF/GPS metadata from source
  photos before they enter the vault. Reconstruction is source-faithful: extract
  a transcription map first, then hand-author identical-geometry EN/UK SVGs;
  unsupported explanatory copy is forbidden. Agent-authored semantic SVG is the
  default; Excalidraw is an optional manual-editing bridge, never hand-authored
  scene JSON. A self-theming diagram must also stay under the 64KB inline
  ceiling (`MAX_INLINE_SVG`): past it the SVG degrades to an `<img>` and freezes
  in one theme. `scripts/validate-image-notes.mjs` enforces all of this at build
  time — see `CLAUDE.md` and `docs/DECISIONS.md` #69, #71, #72.
- Content images get intrinsic dimensions, blur data, responsive WebP variants,
  `srcset`, and `sizes` at build time. Preserve that pipeline.
- The drawer and other dialogs stay mounted so close animations work; closed
  content uses `inert`, and expensive contents may be gated until first open.
  The drawer opens two KINDS of way — deliberately, by the panel icon or the
  `m` key (modal: backdrop, focus trapped), or by the pointer reaching the
  left edge (a peek: no backdrop, focus untouched, closes when the pointer
  leaves). Keep the two distinguishable; `CLAUDE.md` and `docs/DECISIONS.md`
  #74, #75 have the detail.
- Scroll maths (the reading bar, the contents scroll-spy) lives in `lib/` as
  pure functions with `npm test` coverage, not inline in the component — see
  `lib/reading-progress.ts`, `lib/toc-spy.ts`, `lib/intro.ts`,
  `lib/constellation.ts`, `docs/DECISIONS.md` #76.
- The sidebar note strip buckets notes BY WEEK, deliberately: a day grid was
  built first and misrepresented a vault whose shelf notes were typed up in
  batches. Its bar width, gap and `WEEKS` must stay consistent with the 176px
  of inner width in the `w-56` drawer. It is split server/client
  (`components/Constellation.tsx` → `components/ConstellationStrip.tsx`) so
  `lib/vault.ts` stays out of the browser bundle, and is rendered by
  `app/layout.tsx` and handed to `Chrome` as an element, never imported by
  `Chrome` itself. `today` stays a prop. The count line is hidden until hover
  or focus and silent while a week is open, and a bar opens that week's notes
  in the drawer's flow, styled as the same rows as the section list — with no
  backdrop element, which would swallow the first click on the nav beneath it;
  outside clicks are a `pointerdown` listener, and the drawer closing collapses
  the week via an `IntersectionObserver` on the strip, not a prop from Chrome.
  Under `max-height: 700px` it floats as a card instead, so a long week can't
  squeeze the section list off a short window. Keep the section list ranked
  above it: the week list stays capped well under the nav's own height. See
  `docs/DECISIONS.md` #80.
- The first-visit intro hides the whole page behind `data-intro` on `<html>`.
  Never hide intro content in the HTML itself, and never remove one of its
  exits: any click/key/scroll/touch, the driver's own completion, and the 8s
  failsafe plus early pointer/key listeners in the gate script in
  `app/layout.tsx`. The gate must stay an inline `<head>` script (only that
  runs before the first paint) and must keep its pathname check. `INTRO_KEY` is
  duplicated between `components/Intro.tsx` and that script because the script
  runs before modules load — change both or every visitor becomes new again.
  Three details are load-bearing and were each a visible flash before review:
  the heading stays hidden until the driver adds `.tw`; the chrome is hidden
  and revealed BY NAME, never as `body > *:not(main)` (that also caught the
  drawer backdrop and the closed dialogs and faded a dark sheet over the page);
  and the character spans are never reassembled, because that reflows the
  title. Anything that manages its own visibility must be left to manage it.
  See `CLAUDE.md` and `docs/DECISIONS.md` #79.
- Keyboard shortcuts match through `shortcutKey()` (`lib/shortcut-key.ts`),
  never `e.key` directly: the site is bilingual and `e.key` is Cyrillic under a
  Ukrainian layout. `docs/DECISIONS.md` #77.
- Motion must answer interaction and disappear under reduced motion/print.
  Preserve the established `.press`, arrow-throw, stagger, and marker patterns.
- Any `animation-timeline` declaration must sit inside `@supports`. The gate is
  not decoration: without timeline support the same declarations run on the
  default TIME timeline and the animation simply plays once on load. Never put
  a scroll-driven animation on a property an element already transitions — the
  animation wins and the transition silently stops working. A drop cap, a
  heading hairline and a shelf parallax were built and then removed; see
  `docs/DECISIONS.md` #81 before rebuilding any of them.
- `app/globals.css` has no `@layer`, so a bare class selector there BEATS a
  Tailwind utility of the same specificity. Do not set `position`, `display` or
  `width` on a class whose element carries a utility for it — that is how the
  floating breadcrumb ended up full-width and scrolling with the page (#81).
- `> [!pull]` is a pull-quote, not a callout, and shares the sidenotes' gutter
  geometry. Change one and the other has to move with it.

## Verification

Use the smallest relevant check while iterating, then run the full required
checks before handing off a code or content change:

```bash
npm test
npm run build
```

- `npm test` uses Node's test runner over `lib/*.test.ts` **and
  `scripts/*.test.mjs`**, through `--import ./scripts/test-hooks.mjs` (which
  registers `scripts/test-resolve.mjs` for the `@/` alias and extensionless
  imports).
- `npm run build` first validates image notes and syncs vault assets, then
  statically generates every route. It is required because it catches broken
  content, imports, and static params that unit tests cannot.
- `npm run validate:image-notes` gates both `predev` and `prebuild`, so a broken
  image note fails `dev` and `build` before Next.js starts. Run it directly when
  iterating on an image note.
- For UI changes, also inspect the affected view in both languages, both system
  color schemes, relevant viewport sizes, keyboard/touch states, and reduced
  motion. If the available environment cannot perform a visual check, say so.
- To verify an arbitrary Tailwind class shipped, search built CSS for its escaped
  selector or inspect computed styles. A plain-text grep can produce a false
  negative.
- Report exactly which checks ran and any failures. Do not claim a check passed
  unless you ran it successfully.

## Planned / future — do not implement without a request

- Supabase-backed dynamic features such as views, reactions, or AMA. Content
  must remain in the static vault even if these are added later.
- Additional section types such as stack.
- Plans for work not yet started live in `docs/plans/` — transient, and
  deleted once the work ships and its reasoning moves to `docs/DECISIONS.md`.
  The folder is currently empty.
