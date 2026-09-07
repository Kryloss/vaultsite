# Decision log

Append new entries at the bottom: number, date, the decision, and the reason that stops it being reversed. Never renumber — ten vault notes and thirty code comments cite entries by `#N`, and `scripts/docs.test.mjs` checks every reference resolves. Rewritten compactly on 2026-09-06 (#147); the full original prose of every entry is in `git log`. Where an entry disagrees with the code, the code wins.

## Index

| # | Decision |
|---|---|
| 1 | Git-based publishing, no Supabase for content |
| 2 | Vault root = repo root |
| 3 | Images mirrored to public/ at build time |
| 4 | Regex preprocessing for Obsidian syntax |
| 5 | Fully static generation, `dynamicParams = false` |
| 6 | Apple Music via free iframe embeds, not MusicKit |
| 7 | Drawer sidebar hidden by default + emoji→SVG icon mapping |
| 8 | Fully static search, SEO, and feeds |
| 10 | Excalidraw via exported SVG, AI diagrams as self-theming SVG |
| 9 | AI content-intake workflow |
| 10 (dup) | Apple Music embed: no sandbox + `credentialless` |
| 11 | Syntax highlighting at build time with Shiki |
| 12 | Hover link previews from a build-time index |
| 13 | Shelf grouped into medium rows, not one mixed grid |
| 14 | Posts and People filter by query string, not by page |
| 15 | Category labels live outside lib/shelf.ts |
| 16 | Backlinks are inverted at build time, not stored |
| 17 | Heading ids are namespaced per language |
| 18 | Inter self-hosted via next/font |
| 19 | Blur-up placeholders as CSS backgrounds |
| 20 | Entry footers carry prev/next only |
| 21 | Backlinks reverted — decision #16 is no longer in effect |
| 22 | Quotes are a synthetic shelf category |
| 23 | Spoilers |
| 24 | Note maturity defaults to seedling |
| 25 | The résumé lives on the Now page, and the PDF is generated from it |
| 26 | The Now page is written as markdown, not YAML |
| 27 | Sections can have subfolders; they mean nothing to the URL |
| 28 | Footnotes render twice — as sidenotes and as a list |
| 29 | Selecting text offers a link to the selection |
| 30 | The lightbox is a gallery |
| 31 | Vercel Analytics, and nothing else |
| 32 | Image dimensions come from the same pass as the blur placeholders |
| 33 | Speculation rules prefetch, never prerender |
| 34 | Keyboard shortcuts read the page instead of being handed it |
| 35 | Cmd+K runs commands, not just searches |
| 36 | The reading bar pauses at media rather than being driven by it |
| 37 | `l` switches language, and the resistance line is a donation link |
| 38 | Motion pass: entrances, edges, and one marker that moves |
| 39 | Scoped search, remembered position, and a link to the source |
| 40 | BreadcrumbList, and the bug it turned up in reading position |
| 41 | A video is only a VideoObject once it can prove it |
| 42 | A series is a relationship, not a place |
| 43 | The audit pass: what every page was carrying |
| 44 | Motion that knows where it's going |
| 45 | Reverting the navigation transitions |
| 46 | Recents, time remaining, and grain |
| 47 | Why "Continue" never appeared on a phone |
| 48 | A diagnostic you can read off a phone |
| 49 | "Arrived at the top" was the wrong question |
| 50 | One chip, two answers |
| 51 | The phone's top corners |
| 52 | Override below, or not at all |
| 53 | The chip swaps vertically, and the lightbox arrows come off the picture |
| 54 | One height for every shelf card |
| 55 | A dip, so a tap has an answer |
| 56 | Colour on hover: the social icons |
| 57 | Shelf previews show the cover |
| 58 | The global layer: one shell, and tokens instead of accumulation |
| 59 | The design, judged rather than remembered |
| 60 | The floating chrome was the page's own colour |
| 61 | Consequences of the serif |
| 62 | A standing pages rail — BUILT AND REMOVED |
| 63 | The accent is green |
| 64 | No accent, and no emoji outside the sidebar |
| 65 | Series read state, `j`/`k`, a terminal, and one idea that didn't survive the day |
| 66 | Motion that answers, in four places |
| 67 | The breadcrumb reads outside-in |
| 68 | "Кирило" in the breadcrumb, and home stays grey |
| 69 | Image notes keep the reconstruction and the evidence |
| 70 | Formatting Playground is a published reference |
| 71 | Image-note reconstruction is source-faithful and build-validated |
| 72 | Photographed notes extend the semantic-SVG workflow |
| 73 | Two agent files, one reference |
| 74 | The left edge opens the sidebar |
| 75 | `m` opens the menu, and the keyboard opens it modally |
| 76 | The contents' reading line comes down to meet the end of the page |
| 77 | Shortcuts read the character, then the key |
| 78 | `rel="me"` on the social links |
| 79 | Home types itself in, once per visitor |
| 80 | The sidebar note strip counts weeks, not days |
| 81 | Pull-quotes, and a layered blur on the floating chrome |
| 82 | Home's breadcrumb is gone, not shortened |
| 83 | The edge peek waits 90ms before it opens |
| 84 | "New" is measured against your last visit, not against the clock |
| 85 | The hover card gives every cover its own shape |
| 86 | A shelf note opens with the person who made it |
| 87 | A headerless table is a fact list, not a data table |
| 88 | The rating is a fact, so it lives in the fact list |
| 89 | The header block is one column, not two stacked |
| 90 | The music page borrowed Apple Music's shapes |
| 91 | A music note opens like a shelf note |
| 92 | The note's colour spreads; the embed's footer goes |
| 93 | The wash's own rim was the line you could see |
| 94 | The album is the subject, so it sits in the margin |
| 95 | On a phone the album is a corner icon, not a slab |
| 96 | The Play button is the last thing in Apple's player |
| 97 | The players follow the reader's theme, and shrink by scaling |
| 98 | `zoom` for the track player — reverted |
| 99 | The track player is shorter, not smaller |
| 100 | Apple's chrome is cropped off the players |
| 101 | The bottom crop broke playback |
| 102 | What can be cropped, measured from Apple's own DOM |
| 103 | The music page is grouped by artist |
| 104 | On fifteen days a year the counter names the day |
| 104 (dup) | The gutter player was not moving — the viewport was |
| 105 | The format label must not share the title's ellipsis |
| 106 | A shared link is a card from the vault |
| 107 | The gutters' breakpoint is derived, not borrowed |
| 108 | The contents control has one shape, not three |
| 109 | The shelf's video queue is a YouTube playlist, not watch history |
| 110 | The book shelf is spines, and a real one beats a drawn one |
| 111 | A section's prose can sit below its widget, and only music asks for it |
| 112 | The book shelf scales to fit instead of scrolling |
| 113 | Films and shows lead with a ranked list, not the whole grid |
| 114 | IMDb's number is IMDb's, and the stars stay his |
| 115 | A film's poster goes in the gutter, like an album's player |
| 116 | The "New" and "Draft" chips sit on the title's optical line |
| 117 | The music list gets a search box, a language button and genres — and the flag marks the Russian shelf |
| 118 | Local editing is a separate loopback tool, and prose edits as source in place |
| 119 | Top-list ratings and order are author-owned vault data |
| 120 | A shelf note shows its face at both ends of the range |
| 121 | A People note's portrait goes at the head of the contents rail |
| 122 | Local authoring belongs beside the thing it changes |
| 123 | /music is a cover deck, not a list of artists |
| 124 | The sidebar shows the vault's own folders, one level down |
| 125 | A person gets a card, not a thumbnail |
| 126 | A shelf note's arrows walk its own medium |
| 127 | The contents rail joins the gutter column instead of evicting it |
| 128 | The hairline belongs to the outline, and a person leads their own column |
| 129 | A person's thumbnail fills its line, and the column agrees on one left edge |
| 130 | A note's thumbnail keeps the artwork's shape |
| 131 | The thumbnail is sized from a width, and CSS cannot do it any other way |
| 132 | The thumbnail fills the line, and the crop is the price |
| 133 | The thumbnail is out of flow, and its size follows the date line |
| 134 | The reserve is measured, because CSS cannot be told how wide the picture came out |
| 135 | Every shelf note gets the gutter column, and a video gets it without artwork |
| 136 | Two layouts, not three: the gutter column arrives with the rail |
| 137 | Games are a fifth medium, and a game is played |
| 138 | Games open on the Top list, like films and shows |
| 139 | Studio pages: the shelf faceted by who made it |
| 140 | Two chip rows, one at a time |
| 141 | Two rows of chips, and then it scrolls |
| 142 | The studio index is a Top list, ranked by the shelf |
| 143 | The chip row scrolls sideways, and studio mode mirrors category mode |
| 144 | Two flex rows, not a grid: a grid aligns its columns |
| 145 | A file that exists is not an image that is there |
| 146 | One portrait sourced outside the Commons rule, on purpose |
| 147 | The entry files are indexes, and the log keeps its numbers |
| 148 | An attached image is Obsidian's paste, and a translation starts as a copy |
| 149 | The build does not run the advisory lint |
| 150 | The page is the preview, and the source lives in a drawer |
| 151 | A block edits in its own place, and a deleted note goes to the trash |
| 152 | The creator block and the fact cells edit where they render |
| 153 | One bar: the dock, the page options and the tools |
| 154 | The header fields have a second home in the options, and the tools cover the toolbox |
| 155 | The music section's own texts are options, and the bar is one row |
| 156 | The rendered text is the editor, where the render round-trips |
| 157 | A person card's "New" is a mark on the portrait, bottom-left |
| 158 | Krapka, the mascot: a full stop with a face — built, parked |
| 159 | The greeting's full stop as the mascot — built, taken out |
| 160 | One preview cut for both languages, decided on the English body |
| 161 | The 404 is the number: a page with nothing to read is designed as one |

## 1. Git-based publishing, no Supabase for content (2026-07-16)

Content flows Obsidian → Git → Vercel rebuild. Markdown in git is already a versioned database; a sync layer would add webhooks, auth and failure modes to save a minute of publish latency. Revisit only for dynamic features (views, reactions, comments) — and then for those features alone, content stays in git.

## 2. Vault root = repo root (2026-07-16)

The whole repo is opened as the Obsidian vault; content lives in `vault/`. The Obsidian Git plugin is most reliable with the git root as the vault root. Code folders being visible in Obsidian is the accepted cost.

## 3. Images mirrored to public/ at build time (2026-07-16)

`scripts/sync-assets.mjs` copies non-md vault files to `public/vault-assets/` on `prebuild`/`predev` instead of a runtime file-serving route. Keeps the site static and identical in dev and prod. Revisit if media passes ~1GB.

## 4. Regex preprocessing for Obsidian syntax (2026-07-16)

`![[embeds]]` and `[[wiki links]]` are converted by regex before the unified pipeline, not by a remark plugin. **Code is masked first** (`maskCode()`/`unmaskCode()`), because a regex over raw text cannot see a code span — a note documenting the syntax was rewritten into generated HTML. That blindness is the main reason to eventually move to a real plugin.

## 5. Fully static generation, `dynamicParams = false` (2026-07-16)

Every route is pre-rendered; unknown paths 404 at the CDN. Content only changes via git push, which always rebuilds. Revisit if builds get slow (ISR).

## 6. Apple Music via free iframe embeds, not MusicKit (2026-07-16)

MusicKit needs a paid developer account and a runtime token; iframe embeds are free, keyless and theme themselves. Section frontmatter is exposed as `section.meta` so types can read custom keys (`playlists:`).

## 7. Drawer sidebar hidden by default + emoji→SVG icon mapping (2026-07-17)

Sidebar starts hidden at every width. Vault `icon:` stays emoji; known emoji are swapped for inline SVG (`components/icons.tsx`) so the Obsidian workflow never learns new syntax.

## 8. Fully static search, SEO, and feeds (2026-07-17)

Cmd+K searches a build-time index; sitemap, robots, RSS and OG images are all generated at build. Since #43 the index is a static `/search-index.json` fetched on first open rather than a prop in every page.

## 10. Excalidraw via exported SVG, AI diagrams as self-theming SVG (2026-07-17)

`![[X.excalidraw]]` resolves to the plugin's exported SVG; AI diagrams are single self-theming SVGs. Rendering live Excalidraw scenes is too heavy for a static build.

**Self-theming SVGs must be INLINED, not `<img>`-embedded.** Through `<img>` the browser rasterises once and freezes the SVG's `prefers-color-scheme` at first decode, so diagrams got stuck in the wrong theme, at random. `inlineSelfThemingSvg` swaps them into the page; styles are namespaced to `#d-<filename>`. Rules that fell out of it:

- The swap runs on the FINAL HTML, after every other regex — inlined earlier, the wiki-link and progress regexes rewrite the diagram's own labels and a `<span>` inside SVG breaks the parser out of foreign content.
- Raw HTML helpers emit ONE line (a blank line ends a markdown HTML block), and a block-level tag alone on a line needs blank lines around it or it swallows the next paragraph — but only when `standalone()` says it really is alone.
- Only SVGs whose source contains `prefers-color-scheme` are inlined, capped at 64KB; two-file Excalidraw exports keep `<img>`.
- `color-scheme: light dark` on `:root` was tried and reverted; if re-added (it fixes dark scrollbars) re-check every diagram.
- Inlined diagrams open in the lightbox as MARKUP, re-namespaced `#d-<name>-lightbox` — an `<img>` there would reintroduce the freeze.
- Verify structurally on the built HTML (balanced `<svg>`, no `<p><text`), not by eye.

## 9. AI content-intake workflow (2026-07-17)

Raw content → AI structures it per `docs/CONTENT-WORKFLOW.md`: light-touch editing, questions only when genuinely ambiguous, publish directly. Revisit to draft-first if mistakes reach production.

## 10. Apple Music embed: no sandbox + `credentialless` (2026-07-18)

The embed intermittently stalls on Apple's gray skeleton after repeated visits (stale first-party storage under apple.com). A storage-isolating `sandbox` leaves the player permanently gray — rejected. `credentialless` on the iframe gives Chromium a fresh ephemeral partition each load and is ignored elsewhere — kept; React 19 drops unknown boolean attributes, so it is passed as `credentialless=""` (type in `types/iframe.d.ts`). The in-widget "Open in Apple Music" footer link that shipped here was removed in #92.

## 11. Syntax highlighting at build time with Shiki (2026-07-24)

Fenced code is highlighted at build (`lib/highlight.ts`, `rehypeCodeBlocks`), dual themes as `--shiki-light`/`--shiki-dark` variables, zero client JS. The language list is explicit — the full grammar bundle is ~10MB per build; unknown languages fall back to plain text. `rehype-raw` discards hast `data`, so the fence's info string is copied onto the element by `rehypeCodeMeta` before it runs and comes out as `dataMeta`; both spellings are read.

## 12. Hover link previews from a build-time index (2026-07-24)

Internal links in `.prose` show a preview card on hover, pointer devices only, `pointer-events: none` so it can never swallow a click. Filtered per page since #43; layout is #85. The card flips above by anchoring `bottom`, so its height never has to be measured.

## 13. Shelf grouped into medium rows, not one mixed grid (2026-07-25)

One row per medium, each linking to `/<section>/type/<medium>`: 16:9 thumbnails and 2:3 covers in one grid leave holes `grid-auto-flow: dense` cannot fill. The extra `type` segment keeps medium names out of the entry slug namespace. Shelf categories are real static pages (`/…/<category>`), not client state: a `?category=` read in an effect fired before the URL committed, and `useSearchParams()` on a static route forces the grid behind Suspense.

## 14. Posts and People filter by query string, not by page (2026-07-25)

`/posts` and `/people` read `?category=` via `useSearchParams()` in a client half, Suspense fallback = the full unfiltered list so crawlers get the rows. The owner asked for no per-category pages here. Costs: no filter with JS off, no title/OG/sitemap for a filtered view. Promote to real pages the way the shelf does if that ever matters.

## 15. Category labels live outside lib/shelf.ts (2026-07-25)

`lib/categories.ts` imports nothing but a type. `lib/shelf.ts` reaches `fs`; the moment a client component needed a label the build failed with `Can't resolve 'fs'`. Anything a client component might need sits in a module with no server-only imports.

## 16. Backlinks are inverted at build time, not stored (2026-07-26)

Reverted the same day — see #21.

## 17. Heading ids are namespaced per language (2026-07-26)

Both languages ship in one document, so the Ukrainian body renders with `idPrefix: "uk-"` (`rehypeHeadings` in `lib/toc.ts`, after `rehype-slug`) or two headings mint one id and the browser jumps to the hidden copy. The TOC label is read before the `#` anchor is appended. Anchors are off in RSS. Projects prefixes each entry with its own slug.

## 18. Inter self-hosted via next/font (2026-07-26)

Superseded by #59 and #61 (Source Serif 4, Inter removed). Two things survive: the Cyrillic subset is mandatory, and a font variable must have exactly one owner — `--font-sans` was won by whichever rule Next emitted later.

## 19. Blur-up placeholders as CSS backgrounds (2026-07-26)

`sync-assets.mjs` writes a 16px WebP placeholder per raster into the manifest; the `<img>` carries it as its own `background-image`, so the real image paints over it with no JS and nothing to go wrong with `loading="lazy"`. Values are passed as props because `lib/blur.ts` touches `fs`. A missing manifest or sharp degrades to the old behaviour, never a failed build.

## 20. Entry footers carry prev/next only (2026-07-26)

`lib/siblings.ts` + `components/EntryFooter.tsx`: one row, a chevron at each edge. Related-by-category was built and removed the same day — categories are already surfaced everywhere else and the block cost a card of height to restate them. Two stacked cards were the first shape and added ~140px to every page.

## 21. Backlinks reverted — decision #16 is no longer in effect (2026-07-26)

The "Mentioned in" block, `lib/backlinks.ts` and `components/Backlinks.tsx` were deleted the day they were added, at the owner's request. Recorded so nobody goes looking for the module. Bringing it back is ~60 lines over `getWikiIndex()`; the deleted files are in git history.

## 22. Quotes are a synthetic shelf category (2026-07-26)

`/shelf/type/books/quotes` is a real page whose rows are the blockquotes inside book notes (`lib/quotes.ts`), not a `categories:` value; the route resolves it before `categoryFromSlug()`. Bilingual pairing is by index and refuses when the counts differ. Stripping a trailing "— Attribution" was tried and removed: it ate the second half of any quote with an em dash. Quotes are stored verbatim.

## 23. Spoilers (2026-07-26)

`||inline||` and `> [!spoiler]` are a checkbox and label, so they reveal with no JS. The callout's cover is `display: none` once revealed (so text is selectable), and the way back is a second label on the same checkbox — the callout title. Ids run through the language `idPrefix`. The shelf status rows this entry also described no longer exist; `status:` is a cover badge.

## 24. Note maturity defaults to seedling (2026-07-26)

`maturity: seedling | budding | evergreen` on posts; unset or unrecognised falls back to seedling so the badge exists from day one. Rides with the reading stats, so posts only.

## 25. The résumé lives on the Now page, and the PDF is generated from it (2026-07-26)

The résumé is part of Now (same question: what is he doing) — not a section, entry or page. It was frontmatter first; #26 moved it into the body. Still true:

- `scripts/build-resume-pdf.py` renders the PDF from the same source, by hand, never in `prebuild` (a missing Python dependency must not break a deploy). The PDF sits in `vault/Now/` so `sync-assets` publishes it.
- **No phone number or street address anywhere in the repo** — the PDF is public; email and city only.
- Bullets are `Label — detail`; component and script both split on the em dash.
- The block list (Experience, Education, …) is defined once in `lib/resume.ts` and shared by the component, the Now page's `<Toc>` and Cmd+K (a dedicated "Résumé" result plus one per block).
- `/resume` redirects to `/now` in `next.config.ts` — a real page would fork the résumé from the page it must stay in sync with.

## 26. The Now page is written as markdown, not YAML (2026-07-26)

Goals and résumé live in the body of `vault/Now/main.md` and `lib/now-content.ts` parses them back into the structures the components read; Ukrainian is `main.uk.md`, merged by position. Nested YAML is something Obsidian genuinely cannot edit — the Properties panel handles flat keys only — and the vault is supposed to be the CMS. Format: `## Goals` task list (`[x]` done, indented bullet sub-label, `→ [[Note]]` link); `## Résumé` summary + `###` per block + `#### Role · Org` per row with `*period* · sub-label #current`. Flags, links and the PDF name are read from the English file, so a Ukrainian file that drifts can mistranslate a label but never change what the page does. Parsing is forgiving on purpose: an unknown heading warns, never throws, because a typo in a note must not fail a Vercel build. The PDF script has its own ~60-line English-only parser rather than a Node→JSON step.

## 27. Sections can have subfolders; they mean nothing to the URL (2026-07-26)

`getEntries()` walks subfolders; only top-level folders become sections. A slug comes from the file name, never the path, so filing is an Obsidian-side concern and reorganising the vault never breaks a link. `resolveCoverUrl()` finds `cover: sapiens.jpg` like an image embed does (note's folder first, then vault-wide); `entry.sectionDir` carries the real folder. Entry sort has a title tiebreak on equal dates so filesystem order never leaks into the Cmd+K index. `entryMedium()` reads `medium:` then falls back to a folder that names a known medium. Covers live in a `covers/` subfolder per medium; loose media in `attachments/`; scaffolding notes in `Posts/Examples/`.

## 28. Footnotes render twice — as sidenotes and as a list (2026-07-27)

`[^1]` is emitted as remark-gfm's bottom list AND as a `<span class="sidenote">` after its reference; CSS shows one (the margin from the rail's breakpoint, 1168px since #107). Both, because RSS, print and no-JS have no margin. Only all-paragraph footnotes are converted (a sidenote lives inside a `<p>`); one skip drops `all-sidenoted` so the bottom list stays visible. Footnote ids carry the `uk-` `clobberPrefix`, and the `footnote-label` heading is renamed per language and kept out of the outline and Cmd+K.

## 29. Selecting text offers a link to the selection (2026-07-27)

`components/SelectionLink.tsx` copies a `#:~:text=` fragment: nothing stored, nothing to regenerate. Long selections use first and last five words. `?lang=` is always written, `?lang=en` included, so a shared link pins the language it was written in; the pre-paint script lets the URL win without writing it back. It does not translate — there is no sentence-level alignment between a note and its `.uk.md`. Pointer devices only: touch already has a share sheet.

## 30. The lightbox is a gallery (2026-07-27)

Opening a figure collects every visible figure in document order; ← / → step through. Rebuilt on every open from what is actually laid out (`offsetParent`), so the hidden language's copies never join. Arrow keys bind only while open.

## 31. Vercel Analytics, and nothing else (2026-07-27)

Page views, no cookie, no consent banner. Its one side effect: a `BAILOUT_TO_CLIENT_SIDE_RENDERING` template in every prerendered page.

## 32. Image dimensions come from the same pass as the blur placeholders (2026-07-27)

`sync-assets.mjs` records each raster's pixel size in `.image-manifest.json`; `rehypeImageSize` stamps `width`/`height` on content images so nothing shifts as they load. A rehype step because images reach the tree three ways (embeds, markdown, hand-written tags). Explicitly sized embeds (`![[me.jpeg|93]]`) are left alone. Responsive variants followed in #43.

## 33. Speculation rules prefetch, never prerender (2026-07-27)

The layout ships a `speculationrules` script at `moderate` eagerness. Prerender would RUN the page, and `@vercel/analytics` never checks `document.prerendering`, so every hovered link would count as a visit. The win is small (Next already prefetches route payloads) and is not a substitute for smaller images.

## 34. Keyboard shortcuts read the page instead of being handed it (2026-07-27)

`components/Shortcuts.tsx`: `[`/`]` are looked up in the DOM (`a.sibling-prev`/`-next`) rather than threaded through the layout — one source of truth. `g` + digit, not initials: Posts, People, Projects all start with P. The listener must not be re-subscribed on render (a half-typed `g` lives in its closure): `sections` is memoized and the handler never reads state.

## 35. Cmd+K runs commands, not just searches (2026-07-27)

Actions (language, copy as Markdown, copy link, random note) sit in the same list. Pages always sort above actions. "Copy as Markdown" clicks the existing `button.copy-md` rather than receiving every note's source. `when` checks are guarded because a client component still renders once on the server.

## 36. The reading bar pauses at media rather than being driven by it (2026-07-27)

Text pays out continuously; a figure pays out all at once at its bottom edge, at half weight (`MEDIA_WEIGHT` in `lib/reading-progress.ts`). Excluding media entirely made a nine-scan photo essay's bar measure a fraction of the page; counting it fully made the bar almost entirely picture. The read line is the viewport's TOP and the finish line is the article's end reaching the BOTTOM (`finishAt()`) — measuring at the bottom edge opened a tall screen a quarter full, and subtracting the first screenful declared the opening read at 0%. Both are regression tests. `finish` is measured in `measure()`, not per frame. The bar eases (`EASE = 0.18`) with a glow at the leading edge, all off under reduced motion; it writes one custom property `--p`, and `contain: layout` keeps the glow's `left` from touching the page. Maths lives in `lib/` because a wrong answer only shows as a bar filling at the wrong rate.

## 37. `l` switches language, and the resistance line is a donation link (2026-07-27)

`useLang`'s `toggle` is memoized so `Shortcuts`' listener isn't torn down mid-chord. "Day N of Ukraine's resistance" links to a monobank jar styled as nothing at all — a quiet offer, not a call to action.

## 38. Motion pass: entrances, edges, and one marker that moves (2026-07-27)

`.stagger` arrives list items one at a time via `nth-child` delays capped at twelve; reduced motion and print use `animation: none`, not a shorter duration, because with `both` fill a shortened animation still leaves each row invisible for its delay. The ToC highlight is one sliding `.toc-marker` positioned from the live DOM (both outlines mark the same heading; take the first that is laid out). Dialogs stay mounted and toggle `data-open` so they animate out, `inert` when closed, contents gated behind first open (~11KB of markup per page otherwise). The shelf edge fade added here was removed in #45.

## 39. Scoped search, remembered position, and a link to the source (2026-07-27)

`>` scopes Cmd+K to the current page and its headings (`>` alone prints the outline) — an explicit prefix, not an implicit mode. "Open this note on GitHub" reads `data-vault-source` off the page; `repoUrl`/`repoBranch` live in `lib/site-config.ts`. **It depends on the repo being public**, which it silently was not for a stretch; take it private and clear `repoUrl` in the same change. Reading position (`components/ReadingPosition.tsx`) is remembered and OFFERED, never restored automatically; one key holding a map pruned to 20 notes / 30 days; saved on a debounce, on unmount and on `pagehide`.

## 40. BreadcrumbList, and the bug it turned up in reading position (2026-07-27)

`breadcrumbJsonLd()` emits root → section → page, two levels (a subfolder is filing, not structure), last crumb without `item`, home emits none, English only. Reading position never worked: `persist()` read `window.scrollY` on unmount after the router had already scrolled to 0, and StrictMode's mount/unmount/mount wiped the mark on arrival. It now persists the last position the scroll handler saw and writes nothing — deletes nothing — for a visit that produced no scroll; the "arrived at top" check waits a frame. During a navigation the scroll position belongs to a page that no longer exists.

## 41. A video is only a VideoObject once it can prove it (2026-07-30)

Search Console flagged half-populated `VideoObject`s. `videoObject()` builds the complete object or returns null → `CreativeWork`; nothing can emit a partial one again. `uploadDate` comes from a new `uploaded:` key because the site cannot derive it (`date:` is when it was shelved, and would be a false claim). `embedUrl` not `contentUrl`; the watch URL goes in `sameAs`.

## 42. A series is a relationship, not a place (2026-07-30)

`series:` puts a "Part 2 of 5" badge beside the date that opens a popover of parts — a popover, not a permanent card (the card cost every part a column). Anchored to the badge at every width, nudged left by `offsetWidth` (a transformed rect is 3% short mid-transition). Rows are number + title, no dates. Matching is by name, case and whitespace aside — a typo makes a visible second series rather than silently merging two. Oldest-first; `part:` only for what dates can't express. No `/series/<name>` route: the list of parts is already that page, on every part. Vault-wide. `series_uk:` on one part, first found wins. Single-part series render nothing; drafts are not parts in production. Data is pre-computed server-side so the client component never imports `lib/vault.ts`. The metadata row is a `<div>` — a `<nav>` is not allowed inside a `<p>`.

## 43. The audit pass: what every page was carrying (2026-07-30)

- The search index and preview index were props in every page's RSC payload — twice. The index is now `app/search-index.json/route.ts`, fetched on first ⌘K open; previews are filtered per page by `previewsInHtml()`.
- `Post Sample` and `Formatting playground` were live scaffolding; marked draft (see #70 for the playground).
- Canonicals: `pageMeta()` sets `<link rel=canonical>` and `og:url` on every page, or the `?lang=uk` links are indexable duplicates. It re-declares the RSS link and `og:site_name` because Next replaces `alternates`/`openGraph` rather than merging.
- `lang="uk"` on the Ukrainian spans and bodies; `<html lang="en">` never changes.
- Responsive images: 256/672/1344px WebP copies beside each raster (256 = small cover at 2×, 672 = the prose column, 1344 = that at 2×), originals never touched, every `srcset` with a `sizes` (without one the browser picks the largest).
- The drawer became a real dialog: `inert` when closed, focus trapped, skip link first.
- `npm test` gained `scripts/test-resolve.mjs` for the `@/` alias and extensionless imports.

## 44. Motion that knows where it's going (2026-07-30)

`lib/view-transition.ts` holds the capability check; a missing animation must never become a missing navigation. Page transitions and the shelf arrows built here were reverted in #45. The lightbox zoom survives: `flushSync` inside the callback, the `view-transition-name` moved (never copied) between thumbnail and overlay, no cross-fade.

## 45. Reverting the navigation transitions (2026-07-30)

The View Transitions API holds the outgoing frame until the callback settles, which on a client navigation means until React has rendered the new route — a freeze before every slide, which reads as lag. `.page-in` fades on a key change and waits for nothing. The API fits a same-document state change (lightbox) and not a route change. The shelf's hover arrows went too: furniture over the covers for a gesture the row already supports; drag stays. A row that hides its scrollbar and offers no edge treatment is quieter than either; if a "continues" signal is ever needed, it is a peeking half-cover, not something drawn on top.

## 46. Recents, time remaining, and grain (2026-07-30)

⌘K opens onto the last twelve visited paths (`lib/recents.ts`, one key, paths not titles, current page filtered out, skipped in `>` mode). "N min left" bottom-right is driven by the number the progress bar already computes, touches the DOM only when the minute changes, and is quiet below 6% and above 97%. Grain: one fixed 160px `feTurbulence` tile at 2.8% (4.5% dark), `z-index 1`, hidden in print — a surface for a monochrome page without a colour.

## 47. Why "Continue" never appeared on a phone (2026-07-30)

Dismissal keyed on `scrollY > 400`, and mobile scroll restoration fires `scroll`. It keys on reader-generated input now (`wheel`, `touchmove`, scroll keys) and waits 250ms rather than one frame. A scroll event says the page moved, not who moved it.

## 48. A diagnostic you can read off a phone (2026-07-31)

`?rp=debug` prints the reading-position gate values on the page. Opt-in and permanent: this feature's job is to not appear, so "broken or working?" will come up again.

## 49. "Arrived at the top" was the wrong question (2026-07-31)

The gate is now the distance between where you landed and the mark — more than half a screen offers, landing on it stays silent. Same shape as #47: ask what the rule is for, then test that, not the thing that usually correlates with it. On a phone that restores you exactly, staying quiet is correct.

## 50. One chip, two answers (2026-07-31)

Below 640px the floating bar shows the breadcrumb on arrival and the time remaining once you read down. The number crosses from `ReadingProgress` to `Chrome` as an event (`TIME_LEFT_EVENT`), published only when the rounded minute changes; `null` is a real value, published on unmount too. The label is always in the DOM — an element mounted mid-swap has no previous style to animate from. One duration and one curve for both labels.

## 51. The phone's top corners (2026-07-31)

The contents pill is the three-line icon in the top-right, built to the breadcrumb bar's 2.5rem so the two corners agree. It briefly unfurled the current heading while scrolling and that was removed (a chip changing width in the corner of the eye). The sheet hangs under the icon. Superseded in part by #108: the icon is now the only shape below the rail.

## 52. Override below, or not at all (2026-07-31)

A media query adds no specificity, so `.toc-sheet` inside one and outside one tie and the later declaration wins. In a stylesheet with no `@layer`, position is the tie-breaker: an override belongs under what it overrides.

## 53. The chip swaps vertically, and the lightbox arrows come off the picture (2026-07-31)

Breadcrumb and time share one grid cell and pass each other vertically — two boxes resizing in opposite directions inside a shrink-to-fit parent bulge in the middle. The breadcrumb only moves when there is a number to replace it. Below 640px the lightbox arrows join the counter ("‹ 1 / 2 ›"); the wrapper is `display: contents` on wide screens.

## 54. One height for every shelf card (2026-07-31)

`--shelf-card-h` (190px, 170px below 480) is the constant and widths derive from it, so rows line up down the page. Videos keep 16:9 uncropped at two thirds of that height (`--shelf-video-h`) rather than being cropped to 4:3. Grids are unaffected. A false claim about Tailwind not emitting `w-[calc(…)]` came from grepping for the unescaped class — grep for the escaped form or read the computed style; a tool that cannot find something is not evidence it isn't there.

## 55. A dip, so a tap has an answer (2026-07-31)

`.press` scales a control to 97% while held (`.press-soft` 99% for cards, via `--press-scale`). Opt-in, not `a:active`: a scaled inline link nudges the words around it, and controls that own their transform would be thrown off screen. The rule names the colour properties too, or an unlayered `transition: transform` deletes the hover fade. The block sits at the END of `globals.css` because earlier `transition:` shorthands reset `transform`.

## 56. Colour on hover: the social icons (2026-07-31)

The social icons take their platform colour on hover — recognition, not decoration. GitHub and X take a near-white in dark mode; Instagram's gradient is a second stroked copy cross-faded (`url(#…)` doesn't interpolate) with `gradientUnits="userSpaceOnUse"`; LinkedIn gets a white plate under its cut-out letters. Mail stays `var(--text)` — it isn't a platform. The people-photo desaturation that was the other half of this entry was removed in #125.

## 57. Shelf previews show the cover (2026-07-31)

`ogImage()` takes an optional cover; shelf and music only (a post has no cover, a person's face is not a thing to paste into a preview). Inlined as a data URL — no server exists during the build to serve `/vault-assets/`. Every failure returns undefined and falls back to the text card; a preview that throws would fail the page's build.

## 58. The global layer: one shell, and tokens instead of accumulation (2026-07-31)

`components/Page.tsx` owns the page shell (it was pasted into seven routes, two already drifted). Ten corner radii became four tokens equal to Tailwind's scale; eleven durations became `--ease` + three steps that Tailwind's defaults point at. `--surface` split off `--bg-hover` so a card's fill and the pointer response can be tuned apart.

## 59. The design, judged rather than remembered (2026-07-31)

Shipped briefly as one of two switchable themes so it could be compared; the switch is gone and these are simply how the site looks: a wide tonal range; one big thing per page (`.page-title` fluid 2–2.875rem); square faces, not 2:3 (tried and reverted); dark mode with `--surface` above `--bg`, not light mode inverted; **one voice — Source Serif 4 everywhere except code**, including chrome and diagram labels (`svg.diagram text` restyles inlined SVGs from CSS, the vault untouched); demoted metadata; space that groups. The accent point in the original list was undone by #64. Newsreader was chosen and rejected for having no Cyrillic: **script coverage is a hard filter applied before a typeface is judged on looks.**

## 60. The floating chrome was the page's own colour (2026-07-31)

The pills were `--bg` at 75% over `--bg` — invisible in dark mode, where there is nothing to smear. Reverting the background was the wrong fix; `--chrome-bg` is now built from `--surface` in dark mode plus a hairline as an INSET shadow (a border would break the shared 2.5rem height). When something is invisible, ask what it is drawn FROM before changing what it is drawn ON. Dark `--border` and `--text-tertiary` came back up: the rule is distance from the background, and which direction that is depends on the mode.

## 61. Consequences of the serif (2026-08-01)

Inter and Lora deleted — Source Serif's own italic is the quotes voice. `axes: ["opsz"]` is required or `font-optical-sizing` has nothing to act on. `.prose h1` 28px against the 46px page title. `text-wrap: balance` on headings, `pretty` on body. Measure 42rem → 39rem: a typeface change is a measure change. Selection is a tint, not an inversion. The "← Section" link above the title and the border-plus-fill on cards were removed. The accent paragraph here is superseded by #64.

## 62. A standing pages rail — BUILT AND REMOVED (2026-08-01)

Three passes, each quieter, and the honest read was that the thing itself was the problem: the rail answered a question nobody had (seven sections, one keystroke away), and empty margin is what makes a 39rem column readable. Kept because the next idea that begins "there's space over there" should meet this first. Also: a summoned sheet may announce itself; a permanent rail must not.

## 63. The accent is green (2026-08-01)

Superseded by #64. What survives: prose links are text colour (a link every other sentence turns reading into scanning; the underline already says link), and callouts keep their hues.

## 64. No accent, and no emoji outside the sidebar (2026-08-01)

`--accent` is deleted after four passes hunting for the right amount of one colour — the shape of an answer that is zero. State chips, the ToC marker, progress bars, focus rings, the selection wash and action links use `--text`: on a page with no other colour, full text colour IS the emphasis. Callouts keep four hues because there colour carries meaning; the hover-only social-icon exception stays (#56; its people-photo half went in #125). Emoji render in the sidebar only — on a page they are decoration beside a heading that already says the word.

## 65. Series read state, `j`/`k`, a terminal, and one idea that didn't survive the day (2026-08-01)

- Chapter notches on the reading bar: built and removed. A 2px line can carry a position, not a structure. Anything drawn against the bar must convert through `progressAt()`.
- `lib/read-notes.ts` records when you FINISHED a note (bar past 92%, or on arrival for a note shorter than the viewport, which never moves the bar). A different question from reading position. The series badge draws progress along its underline and never changes size; each row has a checkbox because the measurement is a default, not a verdict.
- `j`/`k` walk `.stagger` rows and move real focus (Enter works, screen readers hear it); `.list-focus` paints the hover wash because a row under the pointer and under the keyboard are the same state. Never fires while a dialog is up; doesn't swallow the key on a page with no list.
- Shell fences render as a terminal with three grey dots — red/amber/green would be the only colour on the page.
- The breadcrumb names the section and never the medium ("Kyrylo · Shelf" on every shelf page) — a medium page's `<h1>` IS the medium.

## 66. Motion that answers, in four places (2026-08-01)

An arrow leads on hover and is thrown on press and STAYS thrown: `:active` ends before the next page paints, so `components/ArrowThrow.tsx` adds a class at click that the navigation unmounts. Runs at `--dur-slow` — the one motion meant to be watched. `[`/`]` add the same class. Arrows are spans, never inside a translated string. Checkmarks draw themselves (`stroke-dasharray`, short arm first); the copy button uses an animation (it comes from `display: none`), the series checkbox a transition. Prose links sweep their underline with two background gradients, scoped to real prose because the cost is `skip-ink`. The palette highlight is one sliding marker measured from the DOM; no entrance stagger on results. The metadata line is an array joined, never hand-placed separators; tags take one middot for the set.

## 67. The breadcrumb reads outside-in (2026-08-01)

"Kyrylo · Music", root first; full colour on the last crumb.

## 68. "Кирило" in the breadcrumb, and home stays grey (2026-08-01)

`siteNameUk` feeds the crumb and the wordmark — the two places the name is prose; `siteName` stays Latin for RSS, OG and JSON-LD. Home's crumb was removed entirely in #82.

## 69. Image notes keep the reconstruction and the evidence (2026-08-02)

A diagram embed followed by `<!-- image-note: original.jpeg -->` renders as one figure with a native-radio Diagram/Original switch; Obsidian shows the diagram and hides the comment. Radio names carry the language id prefix. Both views share one stage sized from the photo's manifest dimensions, so switching never reflows the article; the inactive view is `display: none` so the lightbox collects only what is visible. Phone originals are stripped of EXIF/GPS and resized to ~1600px before entering the vault.

## 70. Formatting Playground is a published reference (2026-08-02)

The owner chose to publish it as the inspectable demo of every content feature. `Post Sample` and `Draft example` stay draft.

## 71. Image-note reconstruction is source-faithful and build-validated (2026-08-02)

Every drawn claim must be supported by a transcription map; layout may be reorganised and obvious spelling fixed, but explanatory microcopy is never invented and uncertainty is confirmed or shown as uncertain. `validate-image-notes.mjs` runs before dev and build and checks assets, bilingual geometry and captions, photo aspect/privacy, self-theming and accessibility, transparency, unsafe SVG, and complete exports for embedded Excalidraw. It cannot read handwriting: the map and a visual review remain required.

## 72. Photographed notes extend the semantic-SVG workflow (2026-08-02)

Image notes add a photo-extraction step before the ordinary hand-authored SVG pair; they do not add a second pipeline. An earlier version required bilingual Excalidraw scenes and was reversed — an intermediate artefact that improved nothing. Excalidraw remains optional, for when the owner wants a visually editable drawing.

## 73. Two agent files, one reference (2026-08-06)

`CLAUDE.md` and `AGENTS.md` are each auto-loaded by their own tool and had already drifted apart. Since #147 both are short indexes with an identical shared body, feature detail lives in `docs/*.md`, and a test enforces the pairing. One agent at a time in this working tree: Obsidian Git commits and pushes everything every 10 minutes.

## 74. The left edge opens the sidebar (2026-08-10)

A 16px strip opens the drawer as a PEEK (no backdrop, no `aria-modal`, focus untouched, closes ~180ms after the pointer leaves); the icon and `m` open it MODALLY. `openBy` records the kind, not the input. Drifting past the window edge is not a request to move focus. Clicking the icon while peeking promotes rather than closes. The strip is `display: none` off `(hover: hover) and (pointer: fine)` — on touch it would swallow the back-swipe.

## 75. `m` opens the menu, and the keyboard opens it modally (2026-08-10)

Someone on the keyboard wants to arrow through the sections, which is what the focus trap is for. `m` rather than `\`, which needs AltGr on several layouts.

## 76. The contents' reading line comes down to meet the end of the page (2026-08-10)

The active heading is the last one above a line 140px down the window — and over the final screenful that line descends to the foot of the window at the rate the scroll runs out, so closing sections can take their turn. A fixed line leaves a dead zone one viewport tall; highlighting the last heading at the bottom pixel jumps; moving the line to mid-window makes every other heading late. A page too short to scroll keeps the resting line. `lib/toc-spy.ts`, tested. The click-hold is still needed: several headings sit above the line at the bottom.

## 77. Shortcuts read the character, then the key (2026-08-10)

`shortcutKey()` prefers `e.key` and falls back to the Latin label of `e.code`: `e.key` alone is dead under a Cyrillic layout, `e.code` alone breaks `/` on German and `?` on French. Tested with the layouts as cases. Adding a shortcut on anything but a letter, digit, bracket or slash needs `SHORTCUT_CHARS` and the code map updated.

## 78. `rel="me"` on the social links (2026-08-10)

Every icon carries `rel="me"`, mail included (`sameAs` drops mail because an address isn't a profile). A link in `socials` is therefore an assertion of identity: a friend's profile there would claim to BE them.

## 79. Home types itself in, once per visitor (2026-08-13)

The real `<h1>` is split into per-character spans and typed; the photo is cued by `photoCue()` finding the first name (Infinity if absent); the rest sweeps in; once per browser (`intro-seen`). Everything hangs off `data-intro` on `<html>` and nothing is hidden in the HTML, so every failure ends visible. Three ends: any input, the driver, an 8s failsafe in the gate script. The gate is an inline `<head>` script (the only thing that runs before first paint) with a `pathname === '/'` check; the key is duplicated in `components/Intro.tsx` — change both. Three flashes found by review, all load-bearing: hide the heading until `.tw` exists; hide/reveal chrome BY NAME, never `body > *:not(main)` (that caught the backdrop and closed dialogs); never reassemble the character spans (kerning shifts the title). Skipping fades over 160ms.

## 80. The sidebar note strip counts weeks, not days (2026-08-13)

One bar per week for six months; a day grid showed 25 notes on 5 days and read as abandoned, because the day a shelf note is typed is not the day the book was read. `WEEKS = 25` at 6px + 1px = 174px in the drawer's 176px: bar, gap and count are one decision in two files. Height carries the count so tone doesn't. The total is hidden until hover/focus and silent while a week is open. A week opens its notes IN FLOW as the sidebar's own rows (a popover read as another app), one list refilled per week, outside clicks via a `pointerdown` listener (a backdrop would eat the first nav click), the drawer closing collapses it via `IntersectionObserver`. The section list outranks the week list (`min(28vh, 10rem)` on the `<ul>`); under 700px tall or 639px wide it floats as a card. Bars are buttons (no honest static form). Split server/client and rendered by the layout so `lib/vault.ts` stays out of the bundle; `shortDate` lives in `lib/dates.ts`; counted nouns got `lib/plural.ts` (teens are the trap); `today` is a prop.

## 81. Pull-quotes, and a layered blur on the floating chrome (2026-08-13)

`> [!pull]` floats into the sidenotes' gutter with identical geometry, in flow below the breakpoint; the title is the attribution and it is the only callout with no generated title. The pills take two blur layers so the edge dissolves; **never `isolation: isolate`** — it forms a backdrop root and stops `backdrop-filter` sampling. The sidebar takes one even blur (a graduated one shows as a seam across 224px); its hairline is an INSET shadow (an outset one drew a line down the window while parked); the modal backdrop covers the whole viewport, panel included (stopping it at the panel edge doubled the edge). A drop cap, a heading hairline and shelf parallax were built and removed; any `animation-timeline` must sit in `@supports` or it plays once on load. `.chrome-bar { position: relative }` once beat the `fixed` utility — a bare class beats a utility of equal specificity here.

## 82. Home's breadcrumb is gone, not shortened (2026-08-20)

A crumb is a trail and home's is empty. The label cell isn't rendered (an empty one keeps padding). The chip's padding is NOT conditional: squaring it on home moved the button 2px under the pointer on arrival — the one control that survives navigation must not move.

## 83. The edge peek waits 90ms before it opens (2026-08-20)

`PEEK_DELAY` separates arriving from crossing; not a velocity heuristic. Asymmetric with the 180ms close because an accidental open costs the page and an accidental close costs the thing you reached for. The delay and the strip's width are one setting.

## 84. "New" is measured against your last visit, not against the clock (2026-08-20)

A fixed window says nothing about the reader. One key (`notes-seen`), the marker advances once per SESSION (30-minute gap), memoized for the page's life. A note dated D arrives at the END of D and is compared against the previous visit's timestamp — day-string comparison never fired for the readers who visit most. 30-day cap; first visit badges nothing. Monochrome; client-only; a component not a hook because `PostRows` also renders as a Suspense fallback. Three shapes: chip after a title, pill on a cover (shelf), dot on a spine; `now` excluded — a list of ARRIVALS gets a badge, a page about the present does not.

## 85. The hover card gives every cover its own shape (2026-08-20)

The cover floats and is sized from its own `coverAr` inside 80 × 84; a cover that can't fit shrinks, never cropped; a remote cover falls back to 2:3 `contain`. Nothing in the card may set `overflow` or `-webkit-box` (a formatting context sits beside a float instead of flowing under it), so `EXCERPT_CHARS` (140) bounds the height. A card without artwork shrinks to its text; one with artwork takes the ceiling via `data-cover`, because a float contributes nothing to `fit-content`.

## 86. A shelf note opens with the person who made it (2026-08-23)

Portrait, role, name, bio from `author:` + `author_uk/photo/bio/bio_uk`; role derived from the medium, bilingual, never written. The Author row was deleted from every fact table. Every field degrades alone; `creatorInitials()` (first + LAST word, `|` dropped) is tested because the vault no longer exercises it. Portrait sourcing is a cascade: en-Wikipedia's `pageimages` is only the first guess (it returned a signature), then other languages, Commons search, `globalusage` to confirm identity, the creator's own site, and for a video the channel's own avatar (`oembed → author_url → og:image`) — a channel's avatar is right where a photo of the host would be wrong. Photos are square-cropped on the face at 320px before entering the vault, in one shared `vault/Shelf/creators/` (the asset index is keyed by basename). A row, not a card; the hairline sits under the fact table, not between. A `<div>`, since `aria-label` would be one language. The rating moved to the metadata line, then to the fact list (#88).

## 87. A headerless table is a fact list, not a data table (2026-08-23)

A table whose header cells are all empty — how Obsidian fakes a headerless table, and how every fact block opens — renders as plain rows on shelf and music entry pages only (`RenderOptions.factTables`): what made the card too heavy is the creator block above it, and People notes have no such block, so they keep their card. The `## At a glance` heading is CLIPPED, never `display: none` and never deleted: deleting it dropped half the shelf under `MIN_TOC_HEADINGS` and lost the outline row. The plain treatment deletes the empty `<thead>` in the pipeline; elsewhere `.prose thead tr:not(:has(th:not(:empty)))` still hides it. Below 480px a pair runs on as one line (stacking cost two lines per fact); the creator's bio drops full-width via a grid + `display: contents` with `row-gap` reset to 0.

## 88. The rating is a fact, so it lives in the fact list (2026-08-23)

Appended as the last row by `rehypeFactTables` with the localised label; never on the metadata line. Star geometry in `lib/stars.ts` shared by the plugin and `components/Stars.tsx`; the half star is a nested-`<svg>` clip so there is no `<clipPath>` id to collide on a grid.

## 89. The header block is one column, not two stacked (2026-08-23)

The fact label column is fixed at `--fact-label: 8rem` (`table-layout: fixed`; `auto` let the algorithm overrule the width), sized by Ukrainian's `Одним рядком`; the portrait is 6rem + 2rem gap so its text starts on the same line. Mr. Robot got a real poster and `coverFit: contain` has no user; the feature stays as a last resort.

## 90. The music page borrowed Apple Music's shapes (2026-08-24)

The track-list card, its wash and the row layout were replaced by the cover deck (#123). Still true: entry `description_uk` is `Entry.descriptionUk`, and covers come from the keyless iTunes Search API (`artworkUrl100` → `600x600bb`) into `vault/Music/covers/`. Not Apple's typeface — script coverage decided that once.

## 91. A music note opens like a shelf note (2026-08-24)

Artist block from `artist:` (the KEY selects the role, so no section knowledge), plain fact list, square OG card (`coverShape` replaced a `wide` boolean), `MusicAlbum` JSON-LD. One predicate, `opensWithHeaderBlock()`, gates the creator block AND the fact styling — two halves of one decision. The note's tint is a WASH with no edges (framing it would reverse #86's unframed row); shelf notes get no wash — their artwork is already every list that links to them. A rating was never invented for the note.

## 92. The note's colour spreads; the embed's footer goes (2026-08-24)

The note wash anchors to `main` via `:has()` and spans the window (`left/right: 0`, no `100vw`, no scrollbar risk); `z-index: 0` on `main` keeps the `-1` layer inside. Wider needed deeper and softer. The OG subtitle reads `Kyrylo · Music`, like the breadcrumb. Our "Open in Apple Music" footer was removed — a loaded player already carries Apple's links; the stalled case lost its way out, `ui.openInAppleMusic` is parked for it. `@keyframes wash-in` names only `from`, so `both` ends on each element's OWN opacity — a `to:` would flatten dark mode. Readers can already listen: previews for anyone, full tracks for subscribers, no key.

## 93. The wash's own rim was the line you could see (2026-08-24)

`blur()` fades an image at its own edges, so the artwork bleeds past the box by `--wash-bleed` (more than the blur radius), needs `max-width: none` or the reset caps one axis, and the mask sits on the BOX. Apple's song player clips rather than reflows: 150px is the floor, 130 loses the disclosure line, 110 halves Play.

## 94. The album is the subject, so it sits in the margin (2026-08-24)

An album player is what the note is about and goes to the right gutter from 1400px; a song player is an example of its sentence and never moves. `isAppleMusicSong()` stamps `data-kind`. Scoped by `.music-note` on the page so an album link in a post stays in the writing. The playlist's wrapper card was a frame around Apple's own frame and is gone.

## 95. On a phone the album is a corner icon, not a slab (2026-08-24)

Below 640px the inline album is hidden and a 2.5rem pill in the top-right opens a sheet holding the player (`components/MusicSheet.tsx`, the ToC sheet's pattern). `loading="lazy"` on embed iframes is what makes hiding free: a `display: none` lazy iframe never loads. `.page:has(.toc-bar)` steps the pill left when the outline pill is present. The gutter numbers chosen here were superseded by #96/#97.

## 96. The Play button is the last thing in Apple's player (2026-08-24)

The gutter height clip is reverted: Apple stacks Play LAST, so any short box removes the one control the player exists for. **The player's height is not a knob.** The phone pill wears the album cover (a rounded square, 2.25rem) — on a phone it is the only place the record shows its face; the sheet lost its own frame.

## 97. The players follow the reader's theme, and shrink by scaling (2026-08-24)

`theme=auto` on every embed URL makes the player follow `prefers-color-scheme` inside the iframe — no JS, no doubled markup. The gutter player is `transform: scale(0.6667)` from `top left` so it shrinks away from the window, and the rail reads the PAINTED height.

## 98. `zoom` for the track player — reverted (2026-08-24)

Reverted by #99. Two things stand: in-flow elements shrink with `zoom` (layout follows) and fixed ones with `transform` (nothing is laid out against them); and artwork inside a player cannot be hidden — cross-origin, no layout parameter, and cropping it would break the day Apple moves a pixel.

## 99. The track player is shorter, not smaller (2026-08-24)

Full width, 150px — the measured floor. Narrowing and halving made the one thing a reader might operate the smallest thing on the page. The gutter breakpoint stays at 1400px: the player's layout box is 320px even when it paints at 213 (a transform shrinks paint, not layout).

## 100. Apple's chrome is cropped off the players (2026-08-24)

Requested after being advised against (terms, and the data line is a disclosure to the reader); the owner's call. Negative margins under `overflow: hidden`: `--am-crop-top` 24px song / 34px album takes the wordmark and Sign In row; the mechanism is robust, the numbers are Apple's today and will break silently. If a player looks wrong these are the first thing to check; 0 restores it. `.am-crop` supplies the radius the crop removes. The bottom values chosen here were wrong — #101, #102.

## 101. The bottom crop broke playback (2026-08-24)

The bottom band is the "View in Apple Music" link while idle and the transport controls while PLAYING; every measurement had been taken idle. **Measuring a component only tells you about the state you measured it in.** The top crop survives because the header doesn't move. `--gutter-player-h` is derived in one place (265px in `globals.css` today).

## 102. What can be cropped, measured from Apple's own DOM (2026-08-24)

`a.legal-link` (the disclosure line) is always the bottom-most thing Apple renders, in every state; the crop stops at its top: **16px song / 18px album**, read from the shadow DOM with Play pressed, not from a screenshot (which was ~1px into the controls). Re-run the probe rather than re-derive: load the embed top-level, click `button.play-initial`, walk the shadow roots for `a.legal-link`.

## 103. The music page is grouped by artist (2026-08-24)

What a music page is asked is "what is he listening to", which is about ARTISTS: `lib/music.ts` groups notes under the artist they name, newest note first. **`main.md` describes the artist (`artists:`); a note's `artist_bio:` describes that record** — two texts on purpose, or every note repeats the band's history. Artists live in section frontmatter because any `.md` under the folder becomes a page. `format:` is inferred (a track id → Track, else Album) and written only for an EP or single. An artist's portrait and name link to their People note when one exists (matched like `getWikiIndex()`); the bio never links; nothing appears without a profile — tested, since the vault never exercises it. A note with no artist still renders; an unknown artist keeps its group without portrait or bio. The card layout this entry described went with #123.

## 104. On fifteen days a year the counter names the day (2026-08-24)

Eight celebrations take the flag (blue over yellow); seven remembrance days never do — mourning is not painted in the national colours, and the site's register for grave emphasis is the absence of colour. `kind` on the row is the only switch. The tokens are NOT the flag's hex values (invisible at 11px on white, a hole on near-black); what carries is the relationship. Not an accent, held at 0.7 opacity. A hard-edged two-stop gradient clipped to text; `line-height: 1` is load-bearing and 62% is measured. Every string was measured to fit 176px on one line in both languages. Vyshyvanka and Holodomor days move (`nthWeekday()`). Build-time props AND a client re-read, because a static deploy from the 23rd would say Flag Day on the 24th. Tested, including that no day of mourning is a celebration.

## 104. The gutter player was not moving — the viewport was (2026-08-24)

The drift at the ends of a scroll is the browser's elastic overscroll bouncing the whole viewport, fixed layers included; no ancestor was a containing block. `overscroll-behavior-y: none` scoped by `:has()` to the page and width where the player exists — on bare `html` it would also kill pull-to-refresh. When an image reads `naturalWidth: 0`, check the server and the lazy state before the markup.

## 105. The format label must not share the title's ellipsis (2026-08-24)

Title and label are a flex pair — the title shrinks and ellipsises, the label never does — and `min-width: 0` on the wrapper is what lets it. A grid AREA renamed in one place and not the other collapsed the title to 0px. The track rows are gone since #123; the pair rule may still apply to the deck caption.

## 106. A shared link is a card from the vault (2026-08-25)

One renderer for every OG route: Source Serif (static TTFs in `assets/fonts/`, build inputs only), the favicon's chevron redrawn as inline paths (change both copies together), a deterministic dot fingerprint from the title, mounted artwork with `object-fit: contain`. Artwork is the only colour; never add section colours. People stay text-only.

## 107. The gutters' breakpoint is derived, not borrowed (2026-08-25)

1280 was Tailwind's `xl`; the rail fits from 39rem/2 + 2.5rem + 13rem + 1.5rem = 73rem = **1168px**. Rail, sidenotes, pull-quotes and `.resume-reading` move together or the page is lopsided. Re-derive, never nudge. The music player keeps 1400 (#99).

## 108. The contents control has one shape, not three (2026-08-25)

The labelled bottom-left chip between 640px and the rail is deleted; the icon is the only shape below the rail, and the label survives as the button's `title`. The sheet keeps the phone's numbers (13.5rem, 55vh). The last-in-file `max-width: 639px` override went with it.

## 109. The shelf's video queue is a YouTube playlist, not watch history (2026-08-25)

Watch history left the Data API in 2016; a public playlist is two taps and a better signal. Keyless (feed, oEmbed, channel `og:image`). The playlist IS the queue — no seen-file, no skip list; remove from the playlist to decline. The script fetches and diffs and writes no notes: a note needs judgment. `uploaded:` comes from the feed, so every video note is a real `VideoObject`. The opinion is never written — `## Review` holds the literal `*To be written.*`. Branch → PR → merge, never a push to `main`: a server-side merge is absorbed by the laptop's `pullBeforePush`, a direct push races it.

## 110. The book shelf is spines, and a real one beats a drawn one (2026-08-25)

The section page's books row is standing spines; the medium page is the cover grid. **Compact overview, rich detail** — it shipped the other way round and was flipped: `/shelf` is a glance at four mediums, the medium page is where you've chosen books and recognise them by their art. A note with `spine:` shows a photograph at its real thickness (width from the photo's ratio; height still from the COVER's ratio via `spineHeight()`, never a hash); drawn text is suppressed as `sr-only` with `alt=""`. Everything else is generated from the cover's dominant colour (near-white/near-black dropped as paper and ink, hue-bucketed, ink chosen by measured contrast), which does not flip with the theme — the colour is the book's, not the site's. Name a spine asset uniquely; the asset index is a flat basename map. Bilingual images swap by CSS and so must never be lazy (a hidden lazy image never loads — #95 inverted); `themedImg()` still has that latent bug for a future two-file embed. Hover floats the book's FACE above it, small; `pointer-events: none`, z-index on the slot (the stagger animation gives every slot a permanent stacking context), `display: none` on touch so no cover is fetched. `status: reading` scales from the foot (a lift levitated). Every drawn line came off: no border, no ground, no shelf line — bottom-alignment is the shelf. Cropping a photographed spine is `scripts/import-spine.mjs`: per-column median against the corner background, then the book's own lit head and tail; no fixed tolerance serves a white spine and a black one; verify all four edges. **Thickness from page count was built, measured against six real spines, and removed** — right on paperbacks, 10px off on hardbacks, and two same-format volumes contradicted it; do not rebuild. `--spine-w` is 34px, calibrated to the photographed mean. Photographed widths are fractional (rounding cropped 9px through `object-fit: cover`) and per language; pairs imported with a shared crop box do not move on toggle. All eleven are photographed; the generated spine stays as the fallback and is exercised only by tests.

## 111. A section's prose can sit below its widget, and only music asks for it (2026-08-26)

`listRendersBody(type)`/`bodyBelow` in `lib/section-types.tsx`: the page still renders both language bodies and hands ONE node down as `body`, so the pair can never be split. A set rather than a component flag because page order belongs beside the registry.

## 112. The book shelf scales to fit instead of scrolling (2026-08-28)

A twelfth book overflowed the column and the scroller cut Sapiens in half — on the one row that must not scroll. Each slot has an explicit shrink floor so flexbox scales the whole shelf in proportion; height is derived via `aspect-ratio` (`--spine-wn`/`--spine-hn`, unitless); `max-width: 100%` on the spine is load-bearing; the properties live on the slot; the Ukrainian ratio is overridden beside the Ukrainian width. Floor 70%, then back to the scroller. The heading pull is derived too (`--shelf-lead` from the leftmost book's height) — the literal −38px assumed a short book led the row until 11/22/63 sorted first.

## 113. Films and shows lead with a ranked list, not the whole grid (2026-08-28)

`hasTopList()` is the one predicate. Only the unfiltered view: a category is a set to look at (grid), Top is an ordered question (rows). Nothing invents a rating: rated first, then the tail by date/title so a rebuild never reshuffles; `top_order:` from the localhost editor is authoritative when present. "Not rated yet" is a dash on desktop and nothing on a phone. The rank column is sized to two digits and `--top-text-x` derived from it.

## 114. IMDb's number is IMDb's, and the stars stay his (2026-08-28)

Stars are `rating:` out of five; the labelled number is `imdb:` out of ten. Never merged, never swapped: IMDb's average as stars would be a stranger's opinion in his handwriting. A rated entry outranks an unrated one whatever IMDb says. `imdb_id:` is written once, by hand, from Wikidata P345 — never guessed (Seven, Dark, Prisoners); `imdb:` is refreshed by `scripts/imdb-ratings.mjs` from IMDb's daily dataset and lives in the vault, never fetched at build.

## 115. A film's poster goes in the gutter, like an album's player (2026-08-28)

`components/NoteCover.tsx` borrows the player's geometry so two things in one gutter agree where it is; 13rem, the rail's width; own `coverAr`, nothing cropped. Its scope (films and shows, 1400px, gutter-or-nothing, `--note-cover-h`) was widened and replaced by #120, #127, #135 and #136.

## 116. The "New" and "Draft" chips sit on the title's optical line (2026-08-28)

Small text sharing a big text's baseline sits optically low (8px caps against 10.7); `vertical-align: 0.11em` closes the midline gap. Two earlier passes moved the box instead and this file said `vertical-align` was the wrong tool; it was the right one. **When a measurement says centred and it still looks wrong, the reference is wrong.** Draft shares the rule with a transparent border; `.music-meta > span` and `.draft-chip-title` keep their own placing.

## 117. The music list gets a search box, a language button and genres — and the flag marks the Russian shelf (2026-08-28)

ONE button cycling All → ENG → UA → RU (four chips wrapped the toolbar; a dropdown is machinery for four states), `min-width: 3.5rem`, same material as the field. **`lang:` is the shelf a record belongs on, not the language it is sung in** — Нервы are `uk`, BLIND8 are `en`; the key records a decision, so never "fix" it from the lyrics; a list for a record on two shelves; none means All only. The RU label takes the flag's tokens — asked for, and the one stretch of #104's rule; a third use ends it. Search is the palette's two passes: word-PREFIX (substring matched "St**ep**an" for "ep"), then labelled trigram over the short strings only. Genres are search terms, never chips: `genres:` from Apple's `primaryGenreName`, and each artist is tagged at build with the union of their notes' genres. Local state, not URL params. `lib/music-filter.ts` and `lib/dates.ts` split off so the client half never imports `fs`.

## 118. Local editing is a separate loopback tool, and prose edits as source in place (2026-08-28)

Rendered HTML has no faithful inverse to Markdown, so clicking prose swaps the article for its exact source. The writer is a sidecar on `127.0.0.1` supervised by `npm run dev`; production replaces the client with a null component and has no rewrite. A URL never becomes a write path: paths come from page markers and are realpath-checked under `vault/`. One browser draft; both files revision-checked together; a two-file save rolls back if the second replacement fails. Attachments stay in Obsidian until their transaction exists.

## 119. Top-list ratings and order are author-owned vault data (2026-08-28)

Stars become a slider and rows drag while the dock is open; a drag writes consecutive `top_order:` across the participating notes, which `sortForTop()` treats as authoritative. Multi-file writes stage, recheck and back up; a failed request restores the DOM order.

## 120. A shelf note shows its face at both ends of the range (2026-08-28)

On a phone the cover sits to the LEFT of the title (`.note-thumb`), a separate lazy element from the gutter poster so no width fetches both. The thumbnail is the DEFAULT and each gutter switches it off at its own breakpoint (`.page:has(.toc-portrait)`, `.page:has(.note-cover)`) — phone-only left a hole between 640px and the gutter. From the gutter's breakpoint the creator block and the fact list join the poster in `.note-gutter`, stacked in normal flow inside one fixed element (`display: contents` elsewhere); the table is lifted out of the article by `rehypeLiftFacts` and re-rendered as `.note-facts` with the same margin, the heading stays put. In the column the role and name stay beside the face; only the bio drops. The sizing passes here (3rem, stretched, cropped) are superseded by #131–#134; the rail guard by #127; the medium and breakpoint by #135/#136.

## 121. A People note's portrait goes at the head of the contents rail (2026-08-28)

A person's portrait IS the subject, so it goes in the rail (a child follows the list; a sibling would need its height). `Toc` gained a slot — rail only, never the phone sheet (`above` since #128). Full colour. A note below `MIN_TOC_HEADINGS` renders `.note-portrait` in the rail's place. The "At a glance" block goes under the face as `.toc-facts`: detection moved onto the hast node's `data` (People keeps its card and has no class to find), the gutter copy is outside `.prose`, and the block is rendered TWICE with CSS showing one. A one-line description under the face was built and removed — what belongs under a face is the facts.

## 122. Local authoring belongs beside the thing it changes (2026-08-29)

The dock is the global switch; creation (`+` beside a section title), Page options under an entry header and Now goal checkboxes render in context while it is open. Creation makes a safe unfinished object: bilingual titles required, `draft: true`, EN/UK pair created with rollback, collisions on filename AND route slug rejected. Page options patch existing frontmatter, comparing against RAW YAML keys. A Now checkbox edits one task marker in both files with a stale-label guard. All refuse while the main editor is dirty. `next.config.ts` must alias the contextual slots in production — a dynamic `import()` behind `NODE_ENV` still ships the client island.

## 123. /music is a cover deck, not a list of artists (2026-09-02)

Twenty-six stacked artist cards made a 7,137px page whose main visual event was a blurred thumbnail. `components/Coverflow.tsx` rakes the covers in 3D; the page is 1,713px. Still grouped by artist (`groupByArtist()` orders, `flattenGroups()` unrolls — never re-sort by date). Artist above the deck, record below; the caption's fact rows are lifted from the note's own markdown by position (`date:` is the note's, not the record's) and fall back to English when the row counts differ. The wash went with the cards. What the reference needed changing:

- Cards are real links that lay out as a grid until `data-ready`, so no-JS and crawlers see every cover.
- **A card is an opaque object**: the recession is `--cf-fade` on the ARTWORK over a `--bg` ground; element opacity on the card made every cover a translucent sheet. `opacity` means see-through, not dimmer.
- An off-centre press centres; a card past 6% takes `pointer-events: none` and `tabIndex -1`.
- The hover veil was removed at the owner's request; `cursor: pointer` is the whole affordance; a response must never be a transform (`paint()` owns it) and cards never take `.press`. `cursor: grab` left the frame.
- **The decision lives on `pointerup`** in the frame, from `data-cf-index` in the DOM; `onClick` is a gate. Three rounds of fixes to the click handler could not work because (6) below. The individual rules: focus centres only on `:focus-visible` (a mouse press focuses the link); `endDrag` doesn't settle a press that never moved; the centre is read from `centredRef`; nothing happens under `DRAG_SLOP` (10px — 6 was inside a trackpad click), and crossing it rebases; the tap-vs-drag test is on the OUTCOME (`TAP_TRAVEL`), not the hand's travel.
- (6) **The real cause was CSS**: `.cf-stage` has `preserve-3d`, its own box sits at z = 0, and every card but the centred one is behind it, so the stage swallowed the press. `.cf-stage { pointer-events: none }`, `.cf-card { pointer-events: auto }`; `user-select: none` moved to `.cf-frame` (the stage no longer takes presses, and a press on padding anchored a selection the drag swept up). Under `preserve-3d` a parent is a sibling plane — ask `elementFromPoint` before debugging the handler.
- (7) **WebKit will not hit-test the raked cards at all** (only the centred one), so the deck measures: `cardAtPoint()` in `lib/coverflow.ts` takes the frontmost box containing the press, and `closest()` covers only the sub-pixel seam. A hit-testing fix verified in one engine is verified in one engine.
- Pointer capture waits for real movement (a captured pointer retargets the `click`). Position is a fractional index painted imperatively. No pagination dots (owner's request). `j`/`k` don't walk a deck.
- **Nothing on the page may change height**: bio in a slot sized by hidden copies of every other bio, description two lines, `MAX_FACTS` 3 with a matching CSS reservation, values one line with `title`, dots never wrap, the caption carries the sum as its own floor. Only a <480px window reserves a second title line.
- Covers may pass `--measure` (`--cf-width`, no scrollbar possible); the artist block may not — it is prose.
- The toolbar is a three-column grid at every width with the portrait in the middle column; below 640px the heading is screen-reader-only and each cheek holds one 5.5rem pill (which is why `ui.musicSearch` is one word). Every item names its `grid-row` or auto-placement drops the search to a second row. The portrait is rendered twice, shown once, `display: none` on the other; the toolbar copy is `aria-hidden` and not a link. `Coverflow` takes `onSelect` in a ref. The one-line rule is a 639px query because the search FIELD's intrinsic width wrapped the heading, not the window.
- Artwork is `position: absolute; inset: 0` (a `100%` image left a grey band at some zoom levels).

## 124. The sidebar shows the vault's own folders, one level down (2026-09-04)

**PARKED behind `sidebarTree` in `lib/site-config.ts` (`false`)**; the flag also covers the pinned drawer. What it turns on: the section you stand in opens onto its real folders (Shelf) or its notes (the rest); an artist tier and a category tier were refused — neither is a folder with a page. Built for every section, drawn for one (layouts have no pathname). A folder row is two controls (twisty + link). Open state is a render-time reset keyed on a COUNT OF ARRIVALS (a slug key handed back a stale folder). **Nothing in the tree opens itself** — hover dwells on sections and folders were built and removed; "close only the folders below" too. Unfold on `max-height` with a `from`-only keyframe (never add `to:`). Navigation PINS a deliberately opened panel (open, plain, no trap); a pinned panel leaves by the pointer or a page press via a document listener, the menu button exempt; `unpeek` asks `:focus-visible`. Desktop only from 640px via `display: none`. Outer list capped at `min(38vh, 17rem)`, scrolled into view by `scrollTop` never `scrollIntoView`; a folder's notes capped at `min(26vh, 10rem)` and only ONE folder open per section — arithmetic, so every sibling stays on screen. `.nav-tree[hidden]` must be restated because any author `display` beats the UA `[hidden]`.

## 125. A person gets a card, not a thumbnail (2026-09-04)

Two compositions either side of 640px, both two to a row: a portrait beside an overlapping `--surface` panel (overlap reads as one object), or the portrait alone with a small name card in its corner. Two fit by scaling the card (280px), never by widening the page — past `--measure` was tried and reverted; the deck earns that because album art is not prose. The panel says the name and description only; `personBlurb()` (three clipped lines of 12px) is deleted. The description is hidden on phones by `display` on the wrapper, never on `.lang-*`. Opaque `--surface`, not a scrim; `max-width`, not a width; the New mark is a chip. The panel needs `position: relative` + z-index (an `<img>` paints above a sibling's background). **`.person-photo`'s desaturation is gone at the owner's request** — every portrait is full colour at rest; #56 is the social icons alone.

## 126. A shelf note's arrows walk its own medium (2026-09-04)

`siblingPool()` narrows the footer's prev/next to `entryMedium()` on the shelf: nothing on the site reads the shelf as one list, and the medium is where you are (#65). Medium-less notes are each other's neighbours. Eight notes show one arrow; tested because the vault would not report a regression.

## 127. The contents rail joins the gutter column instead of evicting it (2026-09-04)

The rail is the LAST CHILD of `.note-gutter` — poster, creator, facts, outline — giving up its own `position: fixed`, because a child follows and no property can emit the height of a bio. It takes `position: relative` (offsetParent for the marker), loses its own `max-height`/`overflow` (the wrapper scrolls), and keeps its hairline flush with the poster. Rendered inside the wrapper when the note has header matter, at the foot of the page otherwise; `display: contents` below the breakpoint costs nothing.

## 128. The hairline belongs to the outline, and a person leads their own column (2026-09-04)

`border-left` moved from `.toc-rail` to a `.toc-outline` box wrapping marker, title row and lists (it ran down the side of the portrait), which also becomes the offsetParent for both. The person goes ABOVE the outline (`above` slot): subject first, then navigation, as #127. The square-thumbnail opt-out here is superseded by #130–#134.

## 129. A person's thumbnail fills its line, and the column agrees on one left edge (2026-09-04)

`.copy-md` hangs off the HEADER's left edge (`.note-header` is positioned, `.page-title` is not) instead of measuring the artwork. The outline takes `margin-left: 0.75rem` when something is above it so the column has one left edge. A People note's fact card (`.person-facts`) keeps the card but labels tertiary, values `--text`, tighter rows. The grid-track sizing tried here is superseded by #133.

## 130. A note's thumbnail keeps the artwork's shape (2026-09-04)

Superseded by #131 (the mechanism named here was not what was happening) and #133/#134.

## 131. The thumbnail is sized from a width, and CSS cannot do it any other way (2026-09-04)

`align-self: stretch` + `aspect-ratio` + `width: auto` does NOT derive a width from a stretched height — the grid took the image's intrinsic width and the row grew to it, and the re-wrapped title then overflowed the row the container had measured. A wider cover narrows the title, which wraps further: past 6rem the header grows faster than the cover, so the gap on a long title cannot be closed by size. Three shapes exist — keep the ratio and accept space, stretch and crop, letterbox in a plate. 6rem became the reserve.

## 132. The thumbnail fills the line, and the crop is the price (2026-09-04)

The owner ranked the constraints: **no hole beats no crop**. The crop is horizontal — the box only grows past the ratio in height, so `cover` trims the sides, never head or foot (background on a face-cropped portrait, margins on a jacket). The `min-height` floor here is superseded by #133.

## 133. The thumbnail is out of flow, and its size follows the date line (2026-09-04)

`.note-thumb` is `position: absolute; top: 0; left: 0; height: 100%; width: auto; max-width: var(--note-thumb-w)`: the header's height is the type's, the artwork's foot lands on the date line, and `width: auto` on a replaced element with a DEFINITE height is the height→width transfer (`top` + `bottom` is not the same spelling — insets don't size a replaced element). The ratio is `width`/`height` ATTRIBUTES on the element, because an unloaded image has no intrinsic ratio and `width: auto` resolves to 0. 6rem is a ceiling; a long title clamps the width and takes #132's crop.

## 134. The reserve is measured, because CSS cannot be told how wide the picture came out (2026-09-04)

The title's offset is the reserve; tracking the artwork would close a cycle CSS refuses (`anchor-size()` resolves to its fallback on an in-flow title; an `aspect-ratio` grid item contributes 0; `min-content` gives 2px). So `lib/note-thumb.ts` reads the drawn width into `--note-thumb-fit`, which CSS takes with the full reserve as fallback (no-JS gets a roomier correct layout). It settles rather than oscillates: the pass is monotone downward and bounded above by `max-width`. Two mounts, like the intro: an inline script after the header for the first paint, `components/NoteThumbFit.tsx` at hydration with a `ResizeObserver` for resize, language and the web font. `suppressHydrationWarning` on the header.

## 135. Every shelf note gets the gutter column, and a video gets it without artwork (2026-09-04)

A book has a poster grid in exactly the way a film does; what the column is for is the note in front of you. A video shows no artwork there (the player is the first thing in its body) and takes the column for creator and facts. The switch is `data-column` on `.note-gutter`, set by the page — `:has(.note-cover)` broke on videos, and music and People notes render the wrapper without wanting the column. `.note-gutter > :first-child { margin-top: 0 }`. `--note-cover-h` is deleted: nothing has read it since #127.

## 136. Two layouts, not three: the gutter column arrives with the rail (2026-09-04)

The column moves from 1400px to the rail's 1168px (#107): since #127 the rail is part of the column, so there is nothing to fight. The music player keeps 1400 for its own reason (#99), the one measured exception.

## 137. Games are a fifth medium, and a game is played (2026-09-06)

Adding a medium is four registrations in `lib/shelf.ts` (`MEDIUM_LABELS`, `MEDIUM_ORDER`, `CREATOR_ROLES`, `STATUS_VERBS`) plus a `ui` string; no component learns the word; `entryMedium()` resolves the folder the moment the label exists. Under Books, last in the order. `STATUS_VERBS` replaced the `WATCHED` boolean because a game is played, not watched; tested since no game carries `status:`. `author:` is the STUDIO (picking one name from three hundred credits would invent an auteur), portraits are the studios' YouTube avatars — see #145. Covers are Steam's 600×900 capsules so the row keeps one ratio. The Metro trilogy uses `series:`.

## 138. Games open on the Top list, like films and shows (2026-09-06)

A game is a work you finish and then rank; `TOP_MEDIUMS` gains one string. No IMDb column — `imdb:` is a film and show key (#114), so a game row is stars or nothing. Facts came from Steam's keyless `appdetails`; three titles off Steam take Wikipedia box art, and Hearthstone (no box art) its iOS icon from the same Apple search API.

## 139. Studio pages: the shelf faceted by who made it (2026-09-06)

A studio page is a category page whose facet is the creator — same segment, route, chips and view; `lib/shelf-creators.ts` is the only new code. Games only, one predicate (`hasCreatorPages()`): a studio repeats here, a director has one film. **A slug colliding with a category is DROPPED, never suffixed** — the category owns the address; dropping is visible, shadowing is not; tested because the vault has no collision. The index is a list of people, never covers (one game's cover beside a studio picks their best on the reader's behalf). The portrait links but is `aria-hidden`; the bio never links; `href` is optional on `Creator`. In the sitemap.

## 140. Two chip rows, one at a time (2026-09-06)

Inside the studios the row lists STUDIOS: category chips there were furniture, and pressing one LEFT the studio rather than refining it — a control lying about what it does. The door chip names where it GOES and is never lit (#143). Combining facets (`/games/rpg/11-bit-studios`) is a filter builder and is not built.

## 141. Two rows of chips, and then it scrolls (2026-09-06)

Nineteen studios wrapped to five rows and pushed the shelf below the fold. Two rows, not one: a carousel hides that the set has a second dimension. The cap is derived term by term; `.filter-chip` pins its line-height (a ratio from `text-sm` made the italic door chip's row taller). `components/ChipRowScroll.tsx` scrolls the lit chip into view with `scrollTop`, never `scrollIntoView` (#80); the box keeps `position: relative` so `offsetTop` measures against it. The axis became horizontal in #143.

## 142. The studio index is a Top list, ranked by the shelf (2026-09-06)

Same `.top-list` markup as the games ranking, ranked by how many of their games are on the shelf — a fact, never stars: a studio's best or average rating attributes to the studio an opinion given about one game (#114's line, drawn against his own numbers). Chips alphabetical, list ranked. Round portrait in the cover column, no hairline.

## 143. The chip row scrolls sideways, and studio mode mirrors category mode (2026-09-06)

A short box scrolling vertically inside a scrolling page makes every flick a coin toss; sideways is a different axis, like the shelf rows. The split is `ceil(n / 2)` in the component (CSS can't count) so an alphabetical set stays in reading order; `grid-auto-flow: column` zigzags. The index heading counts STUDIOS. Studio mode is `Top`, the door (`Categories`), then the values — the door was doubling as the you-are-here marker.

## 144. Two flex rows, not a grid: a grid aligns its columns (2026-09-06)

The two-row grid paid the difference between its two chips in every column (`Top` over `GSC Game World`). Two flex rows pack independently; the stack takes `width: max-content` so the container scrolls; `.filter-chip` gets `white-space: nowrap` + `flex: none`, which the grid's `max-content` columns had done implicitly.

## 145. A file that exists is not an image that is there (2026-09-06)

Seven of nineteen studio portraits guessed from YouTube handles were wrong and passed every check the repo has: a squatted channel serves YouTube's DEFAULT letter avatar; a same-name channel is a different company. **Resolve the channel by `channelId` from YouTube's channel search and confirm the handle's canonical link; then LOOK at the file** (uniform ground + one white glyph, or a grey silhouette, both mean no picture). Checking that a reference resolves is not checking what is on the other end. A verification that compared two empty strings printed SAME for everything — a check that cannot fail is not a check. Ensemble's near-square full logo was under a different file name from the wordmark: ask whether there is ANOTHER logo. Embark was wrongly written off from circumstantial signals; `arcraiders.com` links straight to it.

## 146. One portrait sourced outside the Commons rule, on purpose (2026-09-06)

Christian Linke (Arcane) has no Commons file or Wikipedia article; at the owner's direction the portrait is an IMDb publicity still — non-free, used editorially, credited in the note, cropped square on the head. Tsugumi Ohba is a pen name whose holder is unidentified, so the supplied photo is an attribution, not a record; the frontmatter comment states the uncertainty because the page cannot. Neither reopens the rule: Commons first, official page second, no photo is a fine answer.

## 147. The entry files are indexes, and the log keeps its numbers (2026-09-06)

`CLAUDE.md` (153KB) and `AGENTS.md` (36KB) auto-loaded into every session and had drifted; both are now ~9KB indexes sharing a byte-identical body — rules, working agreements, verify loop, a routing table to `docs/*.md` topic files — with feature detail in the topic files. One test decided what stayed: would an agent act differently without it. This log was rewritten compactly the same day, each entry reduced to its decision and the reason that stops it being reversed; removed entries keep a one-line heading because ten vault notes and thirty code comments cite numbers, and `scripts/docs.test.mjs` asserts every `#N` reference resolves, the entry files route to the same set, every topic file is routed to, and the shared body is identical. Verify loop: `npm run check` (`tsc --noEmit`, `npm test`, image-note validation) plus `npm run build` — via `scripts/isolated-build.mjs` while a dev server is up, since the two share `.next/`. Lint (`eslint .`, Next's flat configs — `next lint` is deprecated) exists but is not in the gate: the baseline had 34 errors, mostly React Compiler rules judging the always-mounted-dialog pattern chosen on purpose; deciding what to do about those is its own change. Revisit when a topic file passes ~25KB or the lint baseline is clean.

## 148. An attached image is Obsidian's paste, and a translation starts as a copy (2026-09-06)

The dock's remaining gap was everything that left the browser for Obsidian: an image, a missing `.uk.md`, a shelf note's status and rating. `/attach-asset` does what Obsidian's paste does and nothing more — the file goes to `<Section>/attachments/` (a cover to the note folder's `covers/`, else beside the note), the embed is `![[name]]`, `cover:` is a basename — because those are the conventions every existing note and `getAssetIndex()` already follow. Three rules keep it from being a second asset pipeline: the format comes from the bytes, never the name (a renamed SVG is refused; SVG can script); the name is slugified and made vault-unique before writing, since embeds resolve by basename and a duplicate would silently show the wrong picture; and the write is a transaction — vault file, then `public/vault-assets/` mirror, then (for a cover) the revision-checked frontmatter patch — where each later failure removes what came before, so the vault never holds an image the site cannot see or a `cover:` that names nothing. The image manifest is deliberately NOT touched: `lib/blur.ts` reads it once per process, so an update would be invisible until the restart that regenerates it anyway. The asset index (`getAssetIndex()`, basename → URL) is a different case — it decides WHERE a cover resolves, and its process-lifetime cache sent a just-attached cover to the section folder instead of `covers/` (a 404); in development it now expires after two seconds, so one render still shares a walk and the next render sees the file. `/create-translation` writes the English body as the Ukrainian one rather than an empty file: an empty sibling renders an empty page, while a copy keeps every heading, embed and link target in place for translating in the same editor. Page options gained Date, Status and Rating; status is written as the medium's verb (`playing`/`to-play` joined the sets in `lib/shelf.ts`, #137's line) and an unfamiliar existing word is kept as its own option, never rewritten by a save of some other field. The body editor's `[[` list reads `/search-index.json` — the index already names every linkable page in both languages, so no second list was built.

## 149. The build does not run the advisory lint (2026-09-06)

#147 added `eslint.config.mjs` and declared lint advisory, but `next build` runs ESLint by itself whenever a config file exists, so the very next push (`Version 2026-09-06 19:36:42`) failed on Vercel at "Linting and checking validity of types" with the 34 baseline errors, and production stopped updating. `eslint: { ignoreDuringBuilds: true }` in `next.config.ts` makes the build match the decision already taken: the gate is `npm run check` plus a build, and lint is run by hand until its baseline is clean. Verified with `node scripts/isolated-build.mjs`. When lint joins `check`, remove the option in the same change.

## 150. The page is the preview, and the source lives in a drawer (2026-09-06)

#118 swapped the article for a textarea, which was honest about Markdown having no lossless inverse and wrong about what the author needs to see: the moment prose was clicked the page stopped looking like the site. The owner asked for the text to stay as it is and the editing to get better, and both are the same design — the article never moves, the source opens in a drawer fixed under the page, and the article re-renders from the draft a beat after each keystroke. The rendering is the site's own: the sidecar imports `lib/markdown.ts` under the test loader's type stripping and `@/` resolver (`scripts/dev.mjs` passes the flags) and `/preview` calls `renderWithHeadings` with the page's options, so callouts, code, wiki links, lifted fact tables and the rating row preview exactly, and no client-side Markdown was added (the working agreement). Everything that used to be a way of losing work became a way of keeping it: drafts persist across a reload in `sessionStorage` and are restored only against matching revisions (dropped with a message otherwise), so the navigation and unload prompts went; Escape leaves the drawer, not the dock; a press on a paragraph jumps to its source line. Two things that had been failing quietly are now named: a sidecar older than the browser (a protocol number in `/session`, or a 404 from an unknown endpoint) reports "restart `npm run dev`" everywhere a request can fail, and a preview the process cannot render says so in the drawer's status line while the rest of the editor keeps working. The React error from portaling into a `dangerouslySetInnerHTML` node, and the textarea not taking focus, both predate this and are gone with the drawer (`autoFocus`, a `document.body` portal).

## 151. A block edits in its own place, and a deleted note goes to the trash (2026-09-06)

#150's drawer kept the page honest and still made the author look away from the text to change it. The owner asked to edit the text directly and keep only the tools at the bottom, so the unit of editing became the block: a press on a paragraph hides that block and stands a textarea in its place holding that block's Markdown, in the prose's own type, while everything around it stays rendered and keeps previewing. This is still source editing — the same lossless contract as #118 — narrowed to the block in front of you, which is what Obsidian's live preview does and why it feels direct. The block's source range is found by its first words and extended by its kind (`blockSourceRange()`), whole words only, plain whitespace before loose gaps, because "At" matching "Attack" and "item two" matching "item one" were the first two bugs; a block that cannot be matched falls back to the whole source rather than guessing. The block's mount is re-anchored by its position among the article's children after every live repaint, since the repaint replaces the article's HTML. Undo, Redo and Cancel close the block: after them its range describes nothing. The bar under the page keeps the tools, a hint when nothing is open, and Source for the whole body; every tool describes itself on hover through `data-tip`, a pseudo-element rather than `title` because a title waits a second and a tool should not. Delete moves the pair to `vault/.trash/` — Obsidian's own trash, ignored by the site, the sync and git — and never unlinks; the wrong press is undone by moving the files back. Page options grew a "More fields" section covering what the docs already call editable frontmatter, each value validated by the sidecar with the sidecar's own words shown when it refuses.

## 152. The creator block and the fact cells edit where they render (2026-09-06)

The two pieces of a shelf note that still needed Obsidian were the creator's bio and the fact rows — the one-liner most of all. Both now edit as plain text where they appear. The creator's name and bio are page fields like the title: `Creator` marks them only when a note page passes `devKey`, because a studio page renders the same block from a section document with no such keys and the dock would have synced empty strings into the header. A fact cell writes back into its `| Label | Value |` row by the label the reader can see, and only when the source value carries no Markdown of its own — a value with a link is edited as source, since typing over its rendered text would silently drop the link. The live repaint skips a cell that has focus and catches up on blur. The bug this pass found: the article's "original HTML", restored on Cancel, was snapshotted after the block mount and the cells' editing attributes were in the DOM, so restoring it re-created a textarea React no longer owned — a ghost you could type into with nothing behind it. The snapshot is now taken with the dock's additions stripped, before a mount goes in. Also here: ↑/↓ at a block's edges walk to the neighbouring block, Backspace in an empty block removes it, the bar's real height drives the page padding (the toolbar wraps on a phone), and the option forms fall to one column under 480px. And the article is no longer repainted while a block is open: the first real keystroke showed the editor losing focus after a quarter second, because a repaint replaces the article's HTML and the browser drops focus from an element that leaves the document even for an instant — synthetic `input` events never noticed. Nothing outside an open block can change, so holding the article still costs nothing; it catches up when the block closes.

## 153. One bar: the dock, the page options and the tools (2026-09-06)

Three surfaces had accumulated — a floating dock at the corner, a Page options disclosure under the entry header, and the tools bar under the page — and each was where it was for a reason that no longer held once the bar existed. They are one bar now: a page row with what the dock held plus a Page options toggle and the status line, the tools row beneath, the options as a panel above. Collapsed, only the pencil remains at the corner, so the reading view is untouched. The options form did not move into the bar's component: the entry page's server slot is what knows the note (its fields, categories, series), so the island stays in the page and portals its form into a mount the bar provides, and the bar shows the toggle once something has arrived there — two islands that mount on their own schedules, coordinated through the DOM rather than shared state. Hover descriptions replaced titles on the moved buttons, which the dock's clipped overflow had prevented.

## 154. The header fields have a second home in the options, and the tools cover the toolbox (2026-09-06)

A People note never renders its description on its own page — it is the card's text on the list — so the inline field had nowhere to be; the same is true of any entry's description. Title and description, both languages, are in Page options now, saved through the frontmatter path like the other options, and the saved event carries `reload` so the dock re-reads the page and its inline markers and undo baseline follow rather than showing the text from before. The tools now cover `docs/CONTENT-WORKFLOW.md`'s toolbox: a callout picker listing every kind the stylesheet styles plus the two the pipeline treats specially, H3, numbered and task lists, footnotes numbered past the last definition in the whole note. Two presses that used to do the wrong thing: a fact cell or an inline field inside the article no longer also opens the block editor (the document-level press handler skips them), and the word count is memoised on the body rather than recounted on every keystroke.

## 155. The music section's own texts are options, and the bar is one row (2026-09-06)

The artist bios the deck introduces are not a note's frontmatter but items in the section's `artists:` list, and the playlists at the top of /music are a key on the same file — neither had any way in but Obsidian. The deck's header is the wrong place to edit a bio in (its height is pinned by hidden copies of every other bio, #123), so /music gets its own options in the bar: the playlists as one link per line, and an artist picker with the Ukrainian name and both bios. The write patches one artist's fields inside the YAML block sequence by the artist's `name:` and leaves everything else — other artists, their comments, `photo:` lines, folded scalars that were not edited — byte for byte; replacing the whole list would have dropped every comment the file carries. The bar became one row with the close pencil last, because two rows and a sentence of instructions were spending the reader's screen on furniture; the sentence lives on a `?` now. The corner pencil moves up one pill when a post's time-left pill is in the corner, having covered it until now. A player tool puts a bare Apple Music or YouTube link on its own line, which is how the pipeline embeds one. And the block being edited renders live under its own editor — its Markdown alone through the same pipeline, 120ms after a keystroke — because holding the article still (#152) had also hidden the one thing the author most wants to see while typing: what this block will look like. Rendering into a box the editor sits above touches nothing that has focus.

## 156. The rendered text is the editor, where the render round-trips (2026-09-06)

The owner asked to edit the text itself, with no field and no preview. #118's reason still stands — rendered HTML has no lossless inverse in general — but it does not have to hold for every block: on the inline subset this site's prose actually uses (emphasis, strike, code, wiki links, plain links, footnote marks, line breaks), the DOM CAN be serialised back to the exact source, and where it can, the block is edited as itself. The decision is made per block by a test rather than a list: render, serialise, compare with the source body byte for byte; equal means the block becomes `contentEditable` and its DOM is the draft, unequal means the block opens as its Markdown in place, as before. The serialiser skips what the pipeline added that the source never had — a heading's anchor, a sidenote's copy, a task's checkbox, a nested list — and those parts are frozen against the caret. Wiki links come back through the page's own href → title index, so `[[Arcane|label]]` survives; a link the index does not know becomes a plain link, which the round-trip test catches before any editing. Enter is a line break, because a Markdown paragraph is whatever sits between blank lines and two breaks in a row are exactly that. The preview box under the editor is gone: in rich mode the text is the view, and where a block still opens as source the result shows the moment it closes. A second pass widened the round-trip to vault image embeds (by basename), bare links and hard line breaks (Enter is `  ⏎`, two Enters a paragraph), removed every hover ring and focus outline the dock had drawn — the caret is the affordance — and stopped the article's preview requests while a block is open in it, since nothing they would paint can change; the render on close goes at once instead of after the debounce.

## 157. A person card's "New" is a mark on the portrait, bottom-left (2026-09-07)

#84 gave the People card the `chip` shape rather than the `cover` one, reasoning that a phone parks the name card in the corner a cover badge wants and that inside the card the mark does follow a title in a row of text. The first half still holds; the second did not survive contact with the layout. `.person-card-panel` is a COLUMN flex above 640px, so the chip beside the name was a flex item, blockified out of its `inline-block`, and took a row of the panel's height to itself for one 12px word — pushing the description down on every card that carried one. The owner asked for it on the photo instead.

It is the `cover` variant now, in the shelf badge's scrim material, and it moves corner: BOTTOM-LEFT, not the variant's default top-right. That is the one corner free in both compositions — above 640px the panel overlaps the portrait's right edge, and below it the panel becomes a small name card in the portrait's own top-right. The override resets `top` and `right` to `auto` rather than letting them cascade, because the shared rule sets both and an absolutely positioned box handed all four edges stretches instead of moving. It sits in the person-card block of `globals.css`, which is below the `.shelf-status, .cover-new` rule it overrides — the file has no `@layer`, so position in the file is the whole of the specificity story.

## 158. Krapka, the mascot: a full stop with a face — built, parked (2026-09-07)

**STATUS: NOTHING ON THE SITE RENDERS THE MASCOT.** The character, its poses and its tokens are in the tree (`components/Mascot.tsx`, `lib/mascot.ts`, `lib/mascot.test.ts`, `--mascot-*` in `globals.css`) and every placement was removed at the owner's request, to be used later. Read the rest of this entry and #159 before wiring it anywhere: they carry the sizes that work, what each placement cost, and the four that were tried and taken out. The tests still run, so the drawing cannot rot while it waits.

The site had a logo (the double chevron in `app/icon.svg`) and no character. What it now has is Krapka — «крапка», a full stop — a round body with two low crescent eyes and an open mouth, signing off the home page. The premise ruled most of the alternatives out before they were drawn: a monochrome site with one serif typeface, no accent token (#64) and no icons in page content can't take a mascot that needs a colour, a second typeface or a shading language. A character that is a piece of punctuation from the body text needs none of the three.

**Three tones, all greys, all tokens.** `--mascot-ink` is `--text`; `--mascot-mid` is that ink mixed toward `--bg`; `--mascot-line` is `#ffffff`. Only the middle one is interesting: mixing TOWARD THE PAGE is what lets one drawing serve both themes, because it lightens near-black ink on the white page and darkens near-white ink on the dark one. There is no copy of these in the `prefers-color-scheme` block and there should not be. The line is white in both themes at the owner's request, having been shown what that costs: on the light page the ring drawn in it is the same colour as `--bg` and therefore invisible. That was the accepted trade — what the white line is FOR is separating the mouth from the face, and it does that on either page.

**Cast shadows were tried and cannot work here.** A drop shadow or an offset copy in `currentColor` inverts with the theme: on the dark page the "shadow" is lighter than the ground, so it reads as a glow under the character or as light coming from below. Hardcoding a dark grey doesn't rescue it either, because `--bg` is already `#08080a` — there is nothing darker to cast onto, and `lib/og.tsx` paints the share cards on a permanently dark `#080809`, so that isn't a safe carve-out. Shading toward the background is the only free way to get depth on this site. Do not reintroduce a cast shadow without a `prefers-color-scheme` branch and a reason.

**The grey is a mouth, not shading, and one stroke is the difference.** The same band with a white line along its top edge stops reading as the underside of a sphere and starts reading as an open mouth with a lip. The mouth is written as an explicit two-arc path (`MOUTH` in `lib/mascot.ts`) rather than cut with a clip and a mask, so the shape carries no ids and two mascots can share a page; the lip alone is stroked, and IS clipped, because its two ends sit exactly on the silhouette and the stroke would otherwise poke out past it as two nubs.

**The size ramp is the part that had to be a tested function.** The eyes are strokes cut out of a fill, so they thin about twice as fast as the body shrinks and close up into an invisible smear long before the silhouette stops reading — the stroke and the arc's depth grow as the drawing shrinks, the same move `next/font` already makes for the text with `axes: ["opsz"]` (#61). Below `DETAIL_MIN` = 28px the mouth, the lip and the ring are dropped entirely: a 12-unit band with a 2-unit line on it is a sub-pixel smudge at that size and only makes the silhouette look dirty. `lib/mascot.test.ts` pins the ramp's direction, because the failure is silent and size-specific — the character keeps its shape and quietly loses its face in one place while looking perfect in another.

**Where it is allowed to appear.** #64 says icons render in the sidebar and never on page content; a mascot is illustration rather than iconography, but the spirit holds, so it stays out of prose. Four were built and all four are now out. The home greeting's own full stop (#159). The resume-reading chip, asleep at 18px in place of the open-book icon, quietened by redefining `--mascot-ink` on that one control — which is why `--mascot-mid` derives from the ink rather than from `--text`, so the mouth follows down with it. The command palette's empty result, walking at 32px in `--text-secondary`, because tertiary washed the mouth out. And a signature at the foot of the home page, which came out first: once the greeting carried one, two on a page was one too many. Both of the latter quieten it by redefining `--mascot-ink` on the one control — which is why `--mascot-mid` is derived from the ink rather than from `--text`, so the mouth follows down with it.

**Three poses, and each is the same drawing.** `rest` is the full stop. `walk` grows the comma's tail — the character has two body states and both are real glyphs, a period at rest and a comma in motion — and leans both eyes into the direction of travel. `asleep` FLATTENS the two arcs rather than replacing them: a curved arch reads as a smile and a flat lid reads as shut, and at the 18px the chip gives it that is the only difference that still reads. Anything needing a second mark — a z, a different eye shape — is invisible there.

## 159. The greeting's full stop as the mascot — built, taken out (2026-09-07)

**STATUS: NOT LIVE.** `app/page.tsx` no longer swaps it and `Intro` is back to its #79 sequence; `replaceFinalStop()` and `mascotSvg()` remain in `lib/mascot.ts`, tested, for whenever this is picked up again. What follows is what was built and why, because every number in it was measured against the real heading and would otherwise have to be found twice.

`vault/Home/main.md` ends its greeting with a period and always will — the vault is the owner's (rule 1). What changed is how that one character is DRAWN: `replaceFinalStop()` swaps the trailing `.` of the home page's rendered `<h1>` for the mascot, at build time, in both languages. The sentence still reads "Hey, I'm Kyrylo Leshchenko."; its last mark is now a face.

**Build-time string surgery, not a client swap.** The heading arrives as HTML from the Markdown pipeline, so there is no JSX seam to render a component into — and doing it in the browser would paint the period first and replace it a frame later, which is the exact class of flicker #79 exists to avoid. The rewrite is a pure function with a test, and it REFUSES rather than guesses: no h1, no trailing stop, or an h1 carrying markup of its own (a link, a bold word) all return the html untouched. Only the first h1, and only its own final period — a stop mid-sentence is not the end of the sentence.

**One drawing, two ways out.** The character now has to reach the page as a component AND as a string, so `mascotInner()` builds the markup and `components/Mascot.tsx` is the `<svg>` around it. The alternative was a second copy of the paths written out for the string case, which would have drifted the first time the mouth moved. The two languages get different `id`s because both headings are in the document at once — the inactive one is `display: none`, not absent — and duplicate SVG ids resolve to whichever comes first, so the Ukrainian heading would have silently borrowed the English one's mask.

**A 0×0 inline-block, so the heading's metrics don't move.** The span takes no space and the drawing is absolutely positioned out of it; the sentence sets exactly as it would with an ordinary period, and the mark rewraps WITH the text because it is in the flow rather than measured against it. `bottom: 0` on a zero-height inline-block IS the baseline, which is what puts the character's feet on the line; its own bottom edge sits 10 of its 64 units lower, so the offset is `height × -0.15625`. The height travels with the markup as `--mascot-px` rather than being copied into the stylesheet.

**It is smaller than the letter it follows, and it keeps its face anyway.** 16px: an 11px body against the "o"'s roughly 13px of ink, so the mark sits inside the line rather than towering over it — a 30px version was tried first and read as a balloon on the end of the sentence. That size is below `DETAIL_MIN`, and `detail: true` overrides the rule, which is why `mascotGeometry` takes the flag rather than the greeting special-casing itself: the lip and the ring now ramp with size the way the eyes always have (`2 → 4` and `3 → 5.4` viewBox units), so a 12-unit band under what would have been a 2-unit line still holds at 11px. Sideways it clears the last letter by its own left inset (10 of 64 units) plus a period's side bearing, written against `--mascot-px` so the whole mark resizes from one number in `app/page.tsx`.

**And it sits LOW.** Its feet on the baseline is where a character stands, not where a dot sits — at this size that read as a ball balanced on the line. The offset carries a second term that sinks it by a quarter of the body, so the mark falls to the foot of the line the way a period's ink does. A period is small enough to sit on the baseline and still look low; this is not.

**The intro now only holds it back.** The mascot is in the heading before any JavaScript runs, so the driver's job shrank to three things: don't bail on it (`heading.children.length > 0` became "any child that ISN'T the stop", since inline markup is still untypeable), put it back after `textContent = ""` has taken it out with the text, and add `.is-on` when the sentence finishes so the CSS lands it. `MASCOT_BEAT` holds the page for that. It is never removed or faded: it is the sentence's full stop and it stays one, which also means a first visit and every visit after it end on an identical page. The staging is scoped to `html[data-intro]` so dropping that attribute simply shows it — and the belt-and-braces reduced-motion block has to reset it too, or a stuck attribute would leave the greeting with no full stop at all.

**Considered and dropped:** the earlier version of this, in which the mascot was a hidden node the driver MOVED onto the period and moved back. It worked, but it meant the character only existed during a first visit, the drawing had to be handed to `Intro` as a child to avoid a second copy, and the node had to be returned to React's parent before unmount. Rendering it into the heading in the first place removes all three problems.

## 160. One preview cut for both languages, decided on the English body (2026-09-07)

The projects feed truncates a long entry at the last block that fits in 1000 markdown characters. Both bodies of a note were measured separately, and that is a bug rather than a symmetry: the same sentences in Ukrainian run about a tenth longer in characters, so the budget bought less of the same note. "This website" is the case — identical five-block structure in both languages, cumulative 978 chars in English against 1063 in Ukrainian — and the block that fell off the Ukrainian side was the entire list of decisions the entry exists to make. One language showed a paragraph and a list; the other showed a paragraph and the sentence introducing a list that wasn't there.

**So the cut is decided once, on the English body, and the translation takes the same block count.** English drives because `.md` is the source and `.uk.md` the translation of it (#9); block structure is preserved by that workflow, so "the same block" is a real position in both. Counting blocks rather than characters is also the only unit that survives the language change — a character budget is a budget in a specific alphabet.

**Two asymmetries are kept on purpose.** A body whose English fits under the limit shows whole in BOTH languages even if the Ukrainian is over it: the pair is one note, and a tenth more characters is not a reason to hide the end of it. And "Continue reading" stays inside the language wrapper, because a translation that runs out before the shared cut is genuinely showing everything and has nothing left to link to — the link is per-language even though the cut is not.

**The one guard.** If a translation's structure genuinely differs — paragraphs merged — the shared cut can cover the whole of it, and a long body would then land on the list page entire. That case falls back to the translation cutting itself, which is the old behaviour, now reached only when the structures disagree.

The maths moved to `lib/til-preview.ts` with `lib/til-preview.test.ts` around it: the vault exercises the happy path on every build but not two bodies drifting apart at the cut, and nothing about a green build would have said the Ukrainian preview had started stopping a block early.

## 161. The 404 is the number: a page with nothing to read is designed as one (2026-09-07)

The 404 opened like every other page — a 24px "404", a line of grey under it, a text link — which is the layout of a page that has something to say applied to the one page that has nothing. It now leads with the number at roughly twice `.page-title`, masked out down its own height over a soft pool of light, with the sentence lying across its tail, two ways out under that, and the "did you mean" guess below a rule.

**It is the one route that fills the window.** `.notfound-page` gives `.page` a `100svh` minimum and centres its column — every other page on the site starts at the top and runs down, and this one has too little in it for that: at the top of a tall window it reads as a page that failed to load the rest of itself. `svh` rather than `vh` because the small viewport is the one that doesn't change when a phone's address bar collapses. The measure, the gutters and `--page-y` are untouched; only the vertical behaviour is new. One consequence is accepted rather than fixed: the suggestions arrive from a fetch after paint, so a 404 that has them re-centres once as they land, inside the entrance fade.

**The fade is a MASK, and the version before it is worth recording.** The first build painted a gradient into the glyphs with `background-clip: text`, `--text` down to `color-mix(… 30%, transparent)`. It worked, and it cost three things: the fill has to be transparent for a clipped background to show, so a browser without `background-clip: text` renders an INVISIBLE number rather than an unfaded one — an `@supports` around it, and a `forced-colors` escape inside that to put `CanvasText` back. And because it faded to ink rather than to nothing, the sentence lying across it needed a third gradient stop to stop the strokes smudging the words. `mask-image` has none of those: the fill stays `--text`, so selection and forced colours are right without being mentioned; unsupported, it simply doesn't fade, which is a number rather than a blank; and it goes to fully transparent, which is what makes the overlap legible. Still nothing about it is a colour (#64) — it takes the digits out towards whatever the page is behind them, in either theme, with one declaration. The prefixed line is kept beside the plain one: Safari read `-webkit-mask-image` alone until 15.4. It ends at 96% because the baseline of a line box this tight sits at about 89%, and a mask finishing earlier amputates the feet of the digits instead of fading them.

**The pool of light needs `z-index: -1`, and that is the whole trick.** A positioned pseudo-element paints AFTER its non-positioned siblings, so the glow drawn on `.notfound-hero::before` lands on top of the number unless it is pushed behind. It is on the wrapper rather than on the number itself, which is the same bug one element further in.

**The sentence sits ON the number, and the fade is what makes that legible.** The first line rides over the tail of the glyphs rather than clearing it, so the two read as one block instead of a heading with a caption under it — a lift of 0.15 of the number's own size, held in `--notfound-size` on the wrapper, because a fixed rem (the `-mt-8` this was adapted from) clears the digits at one end of the clamp and crosses their middles at the other.

**It is a graze, and the first attempt at 0.28 was not.** That put both lines of the sentence across the middle of the digits, where the strokes are still solid — a collision, not an overlap, and it was the first thing anyone said about the page. The fix is two numbers, not one: the lift comes back to 0.15, and the mask has to be GONE by the feet of the digits (`transparent` at 86%, a few percent above a baseline that sits at about 89% of a line box this tight) rather than merely faint there. A mask still a quarter opaque at that height puts the stems of the 4s through the words. The words then land in space the number has already vacated, which is why this reads as one mark rather than two things fighting. Nothing needs a z-index: the sentence comes after the number in the DOM, and `.stagger > *` gives every child its own stacking context.

**Two buttons, no icons.** Home takes the inverted fill the active nav row and the selected chip already use; the second is a quiet surface beside it. The arrows are the site's own `.arrow-glyph`, which throws them on the press — icons stay in the sidebar (#64), so the reference this was adapted from loses its house and compass and keeps its shape. The second button's destination is read from the vault (`getSectionBySlug("posts")`) rather than hard-coded, because a 404 linking to a section nobody published is a 404 pointing at a 404.

**The rule above "did you mean" lives in `NotFoundSuggestions`, not on the page.** The component returns `null` when it has nothing to suggest, and a divider drawn by a wrapper in `not-found.tsx` would then hang under the buttons on every 404 that matched nothing. Its label centres and its rows do not: the label reads as the hero's last line, the list keeps the alignment every other list on the site has.
