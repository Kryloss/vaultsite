# Decision log

Append new entries at the bottom. Format: number, date, decision, why, revisit-when.

## 1. Git-based publishing, no Supabase for content (2026-07-16)

**Decision:** Content flows Obsidian → Git → Vercel rebuild. Supabase is NOT part of the content pipeline.
**Why:** Markdown in git is already a versioned database; a DB sync layer would add webhooks, auth, and failure modes for ~1 minute of publish latency saved. An unused free-tier Supabase project would also auto-pause.
**Revisit when:** Dynamic features are needed (view counts, reactions, comments, AMA). Then add Supabase for those features only — content stays in git.

## 2. Vault root = repo root (2026-07-16)

**Decision:** The whole repo is opened as the Obsidian vault; content lives in `vault/`.
**Why:** The Obsidian Git plugin is most reliable when the git repo root is the vault root. Cost: code folders visible in Obsidian's explorer (harmless; excluded from search via settings).
**Revisit when:** Obsidian Git gains first-class support for vaults nested inside repos, or a two-repo split becomes worth it.

## 3. Images mirrored to public/ at build time (2026-07-16)

**Decision:** `scripts/sync-assets.mjs` copies non-md vault files to `public/vault-assets/` (prebuild/predev hook), instead of a runtime file-serving route.
**Why:** Keeps the site 100% static, works identically in dev/prod, no serverless file-tracing config.
**Revisit when:** Media volume makes the repo heavy (>~1 GB) — then move media to Supabase Storage or Vercel Blob.

## 4. Regex preprocessing for Obsidian syntax (2026-07-16)

**Decision:** `![[embeds]]` and `[[wiki links]]` are converted with regex before the unified pipeline, rather than a remark plugin.
**Why:** Two small, readable regexes vs. an AST plugin dependency. Wiki links resolve within the same section only.
**Revisit when:** Cross-section wiki links or embed transclusion (`![[Other Note]]` embedding note content) are needed.

**Code is masked first (2026-07-24):** the known cost of regex-over-raw-text is that it has no idea what a code span is, so a note *documenting* the syntax got rewritten — `` `![[Name.excalidraw]]` `` in backticks was substituted for generated HTML, and the reader saw a `<span class="excalidraw-missing">` tag inside a code block. `maskCode()` now swaps fenced blocks and inline spans for private-use-area sentinels before step 1 and `unmaskCode()` restores them after step 6, so code reaches remark exactly as typed. This is the main reason to eventually move to a real remark plugin: an AST walker gets this for free.

## 5. Fully static generation, `dynamicParams = false` (2026-07-16)

**Decision:** Every route is pre-rendered at build; unknown paths 404 at the CDN.
**Why:** Fastest possible site, zero runtime dependencies, free tier friendly. Content only changes via git push anyway, which always triggers a rebuild.
**Revisit when:** Content volume makes builds slow (hundreds of posts) — then consider ISR.

## 6. Apple Music via free iframe embeds, not MusicKit (2026-07-16)

**Decision:** The `music` section type embeds playlists with `embed.music.apple.com` iframes (host swap of a normal share link). Section frontmatter is exposed as `section.meta` so types can read custom keys (`playlists:`).
**Why:** MusicKit/Apple Music API requires a paid Apple Developer account ($99/yr); iframe embeds are free, need no keys, and auto-match the visitor's light/dark theme. Brian Lovin's /listening (Spotify history sync) would need an API server + cron — out of scope for a static site.
**Revisit when:** Live "recently played" history is wanted — needs an API route + provider account (Spotify or MusicKit) + Supabase/KV for tokens.

## 7. Drawer sidebar hidden by default + emoji→SVG icon mapping (2026-07-17)

**Decision:** Sidebar starts hidden at every viewport size and slides in from a header menu button; the sticky header shows "<Section> · Kyrylo". Vault `icon:` frontmatter stays emoji-based, but known emoji are swapped for inline SVG icons at render time (`components/icons.tsx`), with unknown emoji rendering as-is.
**Why:** Owner preference (brianlovin-style minimal chrome). Mapping emoji→SVG keeps the Obsidian workflow unchanged — no new frontmatter syntax to learn — while the site gets crisp monochrome icons.
**Revisit when:** A persistent desktop sidebar is wanted again (restore from git history) or the icon set outgrows hand-drawn SVGs (consider lucide-react).

## 8. Fully static search, SEO, and feeds (2026-07-17)

**Decision:** Cmd+K search runs over a build-time JSON index passed as props (no backend, no client fetch). Sitemap/robots/RSS/OG images are all generated at build. OG images use `next/og` with the dark theme, no custom fonts.
**Why:** Keeps decision #1 (no runtime infrastructure) intact; the site is small enough that shipping the whole index in the HTML payload is cheap (capped at 1500 chars of plain text per page).
**Revisit when:** Content grows past ~100 entries — move the search index to a static JSON file fetched on first palette open, or a worker-based index (e.g. Pagefind).

## 10. Excalidraw via exported SVG, AI diagrams as self-theming SVG (2026-07-17)

**Decision:** `![[X.excalidraw]]` embeds resolve to the plugin's exported SVG (theme-aware when light+dark are exported), resolved vault-wide by name via `getAssetIndex()`. AI-generated diagrams are single self-theming SVG files (internal `prefers-color-scheme` styles), embedded like images. `.excalidraw.md` excluded from pages; `.excalidraw` JSON not shipped.
**Why:** Rendering live Excalidraw scenes needs the Excalidraw React app + canvas + fonts — too heavy for a static build. Exported SVG is identical, instant, and git-friendly. Self-theming SVG lets AI diagrams appear with no export step and adapt to the theme. Keeps decision #5 (fully static) intact.
**Revisit when:** Interactive/animated diagrams are wanted (embed an `.excalidraw.json` + client renderer), or a diagram needs to read live page CSS (use inline SVG instead of `<img>`).

**Correction — self-theming SVGs must be inlined, not `<img>`-embedded (2026-07-24):** diagrams were rendering in the wrong theme (light artwork on the dark page), and *which* diagram broke moved around between reloads and between the two language versions of the same page.

Two fixes were applied, in order:

1. **`color-scheme: light dark` on `:root`** — tried first, then **reverted**. The site only ever repainted itself with `prefers-color-scheme` media queries, so its *used* color scheme stayed light, which is what gets propagated to embedded content. It did not fix the diagrams, and it made one that had been rendering correctly start rendering wrong — since it changes exactly which scheme `<img>`-embedded SVGs are told about. Removed once inlining made it irrelevant. If it's ever re-added (it does fix scrollbars and form controls in dark mode), re-check every diagram.
2. **Inlining the SVG into the page** (`inlineSelfThemingSvg` in `lib/markdown.ts`) — the actual fix. An `<img>`-referenced SVG renders in an isolated document that the browser **rasterizes once and caches**; its internal `prefers-color-scheme` is resolved at that first decode and never re-evaluated. That explains the wandering symptom: lazy loading and the language toggle's `display: none` make different images decode at different moments, so each one freezes whichever theme happened to be current. Inlined, the media query is ordinary page CSS — live, correct, and it re-themes instantly with the language toggle and with the OS setting.

**Scope of the change:** only SVGs whose source actually contains `prefers-color-scheme` are inlined (capped at 64 kB). Excalidraw's two-file exports (`.light.svg` + `.dark.svg`) keep the `<img>` path — they swap via CSS `display` and were never affected. Inlined styles are namespaced to `#d-<filename>` by `scopeSvgCss`, since generic class names like `.bar` / `.lbl` would otherwise become global and collide between diagrams.

**Trade-off, since reversed (2026-07-25):** inlining meant diagrams were no longer `<img>` elements, so they stopped opening in the lightbox — accepted at the time on the grounds that they're already full-width. In practice the inconsistency was the annoying part: on a page mixing photographs and diagrams, half the figures opened full-screen and half didn't. `components/Lightbox.tsx` now also matches `.prose svg.diagram` (via `closest()`, since the click lands on a child `<rect>`/`<text>`) and re-renders the diagram as **markup** in the overlay rather than as an `<img>` — using an `<img>` there would have reintroduced the exact rasterize-and-freeze bug this decision exists to fix. The overlay copy is re-namespaced from `#d-<name>` to `#d-<name>-lightbox` (id *and* every selector in its scoped `<style>`) so the page never holds two elements with the same id. Captions in the overlay are taken from the figure's `<figcaption>` rather than `alt`, which keeps the `.lang-en`/`.lang-uk` spans working — so a diagram opened in Ukrainian mode gets its Ukrainian caption.

**The swap runs on the FINAL HTML, not during preprocessing.** This is the important constraint, and it took two broken attempts to find. `preprocessObsidian` is a chain of regexes over the whole document — wiki links, progress bars, Apple Music embeds. Inline an SVG before those run and they rewrite the *diagram's own text labels*: `rendering-pipeline.svg` documents this very syntax, so its labels contain `[progress:: 45]` and `[[x.excalidraw]]`, which became a real `<span class="progress">` inside the SVG markup. A `<span>` inside SVG content is an HTML-parser breakout tag, so the parser abandons foreign content and the diagram renders half-drawn with the remainder spilling down the page as prose. `inlineDiagrams()` therefore runs last, on the stringified HTML, swapping `<img src="….svg">` for the SVG itself once nothing else will touch it.

**Two related traps, both hit while getting this right:**
- *Blank lines.* A blank line inside raw HTML terminates the markdown HTML block, so a pretty-printed SVG gets torn in half — `<rect>`/`<text>` end up orphaned in `<p>` tags. The inlined markup is collapsed to one line; every other raw-HTML helper in `lib/markdown.ts` already emits one line for the same reason.
- *The same rule, inverted (2026-07-25).* Raw HTML standing alone on a line **opens** an HTML block that runs until the next blank line, swallowing whatever follows. `![[me.jpeg|93]]` directly above `# Hey, I'm Kyrylo.` became an `<img>` tag, and the heading was absorbed into that block and emitted as literal text — `#` and all. Image embeds now get blank lines around them, but only when `standalone()` says the embed really is alone on its line; padding an inline, mid-sentence embed would break the paragraph instead. Any future helper that emits a block-level tag needs the same treatment.
- *Verify structurally, not by eye.* Both failures looked like a CSS/theming problem in the browser and were nothing of the sort. The reliable check is on the built HTML: `<svg>`/`</svg>` balanced, `<rect>`/`<text>` counts inside each `<svg id="d-…">`, and zero `<p><text` or stray `<span>`/`<a>` within a diagram.

**Lesson for future diagrams:** `prefers-color-scheme` inside an SVG is only reliable when that SVG is part of the document. Through `<img>`, treat it as frozen at first paint.

## 9. AI content-intake workflow (2026-07-17)

**Decision:** Raw content → AI structures it into vault notes per `docs/CONTENT-WORKFLOW.md`. Policy chosen by the owner: light-touch editing (voice preserved), follow-up questions only when genuinely ambiguous, publish directly (no draft gate).
**Why:** The vault-as-CMS makes AI a natural editor: conventions are mechanical (frontmatter, templates, wiki links) while the writing stays human.
**Revisit when:** Mistakes reach production — flip the workflow's publishing rule to draft-first.

## 10. Apple Music embed: no sandbox + in-widget fallback link (2026-07-18)

**Decision:** The Apple Music embed iframe drops the custom `sandbox` attribute (matching Apple's official embed markup) and gets an in-widget "Open in Apple Music" footer link. Both render paths use the same card+footer look: the `music` section page renders it inline in `MusicList.tsx`; the markdown auto-embed (`appleMusicEmbedHtml`, styled via `.apple-music-*` classes in globals.css) mirrors it. Shared feature-policy string: `APPLE_MUSIC_IFRAME_ALLOW` in `lib/apple-music.ts`.
**Why:** The embed intermittently gets stuck on Apple's gray loading skeleton. The stall happens *after* the iframe's `load` event (which fires in ~200ms), inside Apple's cross-origin player JS, so a static site can't detect or auto-fix it. The `sandbox` was the one code-side variable that could block the third-party storage Apple's player needs to hydrate under strict privacy settings; removing it aligns with Apple's supported embed. A "Reload player" button was tried first but a remount doesn't reliably shake the stall loose, so it was dropped — the fallback link (always works) is the one dependable escape hatch.

**Stale-storage stall + the `credentialless` fix (2026-07-18):** The embed works in a fresh browser but stalls on the gray skeleton after repeated visits — confirmed by the owner: clearing `music.apple.com` cache + localStorage makes it work again. So the player chokes on first-party state it accumulates under apple.com, which our page can't clear cross-origin. Two things were tried:
- *Storage-isolating sandbox* (drop `allow-same-origin` → opaque origin, no storage): **rejected** — verified on production it leaves the player permanently gray. Apple's player needs same-origin storage to hydrate at all.
- *`credentialless` iframe attribute* (on both embed paths): **kept.** Chromium loads a credentialless iframe in a fresh, ephemeral storage partition every load — a "first visit" each time — while keeping the real origin (so the player still works, unlike the sandbox). No regression: Safari/Firefox ignore the attribute and behave as before. Gotcha: React 19 omits an unrecognized *boolean* attribute from the HTML, so it's passed as `credentialless=""` (string) on the JSX iframe and as a bare attribute in the markdown-pipeline HTML string; the JSX type is augmented in `types/iframe.d.ts`. Note: couldn't fully verify the runtime effect in-session (test browser was rate-limited by Apple after many reloads); it's a no-downside progressive enhancement, best confirmed on a clean Chromium profile.
**Revisit when:** Apple ships a reliable embed load/error event we can key an auto-retry on, the stalls stop, or `credentialless` turns out insufficient (then fall back to a click-to-load poster).

## 11. Syntax highlighting at build time with Shiki (2026-07-24)

**Decision:** Fenced code blocks are highlighted during the build by Shiki (`lib/highlight.ts`, wired in as the `rehypeCodeBlocks` step) and wrapped in `<figure class="code-block">` with an optional filename header. Dual themes (`github-light` / `github-dark-dimmed`) are emitted as `--shiki-light` / `--shiki-dark` CSS variables per token via `defaultColor: false`; the theme swap happens in CSS, and backgrounds stay on the site's `--code-bg` rather than the theme's. The copy button is injected client-side by `components/CodeCopy.tsx`.

**Why:** Highlighting in the browser would ship a highlighter (100 kB+) and repaint on every page — this ships zero extra JS and matches decision #5 (fully static). CSS-variable dual themes avoid the usual approach of rendering each block twice, one per theme. Injecting the copy button instead of baking it into the HTML means no dead control when JS is off.

**Gotchas worth remembering:** the language list in `lib/highlight.ts` is deliberately explicit — loading Shiki's full bundle would pull ~10 MB of grammars into every build. Add a language there before using it in a note; unknown languages silently fall back to plain text rather than failing the build. Also: `rehype-raw` re-serializes and re-parses the whole tree, which discards hast `data`, so a fence's info string (```` ```bash title="scan.sh" ````) is copied onto the element as an attribute by `rehypeCodeMeta` *before* `rehype-raw` runs — and comes out the other side renamed to hast's camelCase `dataMeta`. Both spellings are read.

**Revisit when:** Builds get slow (grammar loading dominates), or line highlighting / diff annotations are wanted — Shiki transformers cover those without changing this design.

## 12. Hover link previews from a build-time index (2026-07-24)

**Decision:** Internal links inside `.prose` show an Obsidian-style preview card on hover. `lib/previews.ts` builds an href → {title, excerpt, date, cover} index at build time; the layout passes it to `components/LinkPreview.tsx` as props, exactly like the Cmd+K search index. Excerpts are capped at 180 characters (140 since #85, which also gave the card its layout). The feature is pointer-only (`hover: hover and pointer: fine`) and the card is `pointer-events: none`.

**Why:** Same reasoning as decision #8 — the site is small enough that shipping the index in the HTML payload beats any fetch, and it keeps decision #1 (no runtime infrastructure) intact. The index is roughly a tenth the size of the search index already in every page. Pointer-only because a tap should just follow the link; a non-interactive card can never swallow a click or get stuck open, which is where hover popovers usually go wrong.

**Positioning note:** when there isn't room below the link the card flips above by anchoring its `bottom` instead of its `top` — that way the card's height never has to be measured, so there's no render-then-reposition flicker.

**Revisit when:** The index outgrows the payload (same trigger as decision #8 — around 100 entries; move both indexes to a fetched static JSON at once), or previews are wanted on sidebar/list links too (drop the `.prose` scope, but expect it to feel noisy).

## 13. Shelf grouped into medium rows, not one mixed grid (2026-07-25)

**Decision:** The shelf renders one horizontally-scrolling row per medium (videos, movies, shows, books — order in `MEDIUM_ORDER`, `lib/shelf.ts`), each linking to a statically-generated page at `/<section>/type/<medium>`. The medium filter chips are gone, and with them `ShelfGridClient` — the shelf is now entirely server-rendered.

**Why:** YouTube thumbnails are 16:9 and covers are 2:3. In a single CSS grid a row is as tall as its tallest item, so a short video card beside a tall poster leaves a vertical hole that `grid-auto-flow: dense` can't fill (dense packs horizontally, not vertically). Giving videos a full-width row fixed the holes but made them dominate the page. Grouping by medium means every row holds exactly one card shape, which removes the problem at its source instead of working around it — and it matches how people already read a media library.

**Why the extra `type` segment:** `/shelf/videos` shares a namespace with entries (`/shelf/inception`) and would break the day an entry slugs to a medium name. `/shelf/type/videos` is collision-proof, and a static segment outranks `[slug]` in Next's router. These pages are in the sitemap; they have no OG image of their own and inherit the site default.

**Revisit when:** A medium passes a few dozen items and sideways scrolling gets tedious — cap the row at N items and let "See all" carry the rest, which the medium pages already support.

**Shelf categories are pages, not client state (2026-07-25):** `categories:` is multi-valued and every one gets a statically-generated page at `/<section>/type/<medium>/<category>`; the chips are plain links. The first attempt filtered client-side from a `?category=` query read out of `window.location` in an effect — which silently didn't work, because during an App Router transition the effect can fire before the new URL is committed, so an incoming link landed on the medium page unfiltered. `useSearchParams()` is the correct hook for that, but on a statically-exported route it forces the subtree behind a Suspense boundary, so the grid would vanish from the HTML. Making each category a real page sidesteps both: build-time filtering, no client JS, no flash of the unfiltered grid, and shareable URLs. `ShelfTypeClient` is gone; `ShelfTypeView` is a server component shared by the medium and category routes.

## 14. Posts and People filter by query string, not by page (2026-07-25)

**Decision:** `/posts` and `/people` read an active category from `?category=…` via `useSearchParams()` in a client half (`PostListClient`, `PeopleGridClient`), wrapped in a Suspense boundary whose fallback is the same list rendered unfiltered. The Shelf keeps its real per-category pages (decision #13). Chips are `<Link>`s rather than buttons, so the URL is the single source of truth and the back button works.

**Why the split from the shelf:** the owner asked specifically not to add pages for these two. The shelf's categories are scoped per medium, so they stay a small, bounded set; posts and people categories are open-ended and each one would be another route. It's a deliberate inconsistency, not an oversight.

**What it costs, and why the Suspense fallback matters:** `useSearchParams()` forces its subtree to render on the client, so without a fallback `/posts` would ship to crawlers with no posts in it. The fallback renders the full unfiltered list into the static HTML, which fixes that but means the list markup appears twice in the payload and a filtered URL shows everything for a moment before narrowing. And **filtering silently does nothing with JavaScript off** — the chip navigates, the same static HTML is served, no filter applies. Query-string views also get no `<title>`, no OG image, and no sitemap entry.

**Revisit when:** those filtered views need to be shareable or indexable, or the JS-off behaviour starts mattering — then promote them to real pages the way the shelf does, reusing `PostRows` / `PeopleCards`, which are already presentational and take `active` as a prop.

## 15. Category labels live outside lib/shelf.ts (2026-07-25)

**Decision:** `CATEGORY_LABELS` and `categoryLabel()` live in `lib/categories.ts`, which imports nothing but a type. `lib/shelf.ts` re-exports `categoryLabel` so existing server-side imports keep working.

**Why:** the labels started in `lib/shelf.ts`, which reaches `lib/vault.ts` and `lib/markdown.ts` and therefore `fs`. The moment a client component (`PostRows`) needed a category label, the build failed with `Module not found: Can't resolve 'fs'` — the whole server chain was being pulled into the browser bundle. Anything a client component might need has to sit in a module with no server-only imports.

## 16. Backlinks are inverted at build time, not stored (2026-07-26)

**Decision:** `lib/backlinks.ts` walks every note, resolves its `[[links]]` with the *same* wiki index and same-section fallback `preprocessObsidian()` uses, and inverts the result into target URL → linking pages. `backlinksFor()` on an entry page renders the "Mentioned in" block; nothing is written back into the vault.

**Why:** the forward index already existed (`getWikiIndex()`), so the reverse direction is a second pass over content that's in memory anyway — 49 notes, unmeasurable. The alternative, `backlinks:` frontmatter maintained by hand or by a script, would drift the moment a note is renamed and would put generated data in the owner's vault, which breaks rule 1 in CLAUDE.md.

**Two things it deliberately does:** it strips fenced and inline code first (a note documenting `[[wiki links]]` in backticks isn't linking anything — same class of bug as decision #4), and it folds the English and Ukrainian bodies of a note into one deduplicated source, so a translated note doesn't appear twice in its target's list. Links to unpublished notes are dropped by checking the resolved URL against the set of real pages.

**Memoized only in production:** the vault isn't a module import, so nothing invalidates the cache in dev — a link added in Obsidian has to show up on the next dev render.

**Revisit when:** a graph view is wanted. The same inverted map is most of what one needs; it would want edge direction kept on both sides rather than flattened.

## 17. Heading ids are namespaced per language (2026-07-26)

**Decision:** one rehype step (`rehypeHeadings` in `lib/toc.ts`, running after `rehype-slug`) prefixes heading ids, collects the h2/h3 outline for the table of contents, and appends the `#` anchor. Entry and section pages render the Ukrainian body with `idPrefix: "uk-"`; `TilList` prefixes each entry with its own slug.

**Why the prefix:** both languages ship in the same HTML document (see the language-toggle note in CLAUDE.md), so two independent `rehype-slug` runs can mint the same id twice. A heading spelled the same in both languages — or any two entries sharing a heading on the projects feed — would produce a duplicate `#setup`, and the browser jumps to the first match, which is usually the copy that's currently `display: none`. That reads as "the anchor link is broken" rather than as an id collision, which is why it's worth the extra option.

**Why one step for all three jobs:** they all need the post-`rehype-slug` heading nodes, and the TOC label has to be read *before* the `#` anchor is appended or every entry would end in a stray hash.

**Anchors are off in the RSS feed** (`anchors: false`) — a bare fragment link means nothing in a reader.

**Revisit when:** headings need stable ids across renames for permalink purposes, or the TOC should cover h4.

## 18. Inter self-hosted via next/font, owning Tailwind's `--font-sans` (2026-07-26)

**Decision:** Inter replaces the system stack, loaded by `next/font/google` in `app/layout.tsx` with the `latin`, `latin-ext` and `cyrillic` subsets, exposed as `--font-inter`. `globals.css` then points Tailwind's `--font-sans` theme token at it in an `@theme` block, and `body` just reads `var(--font-sans)`.

**Why the Cyrillic subset is mandatory:** every note ships a Ukrainian translation. Without it those bodies fall back to a system font and the page silently changes typeface when you hit the language toggle. This also ruled out several fonts that would otherwise have suited the design reference — Geist and Newsreader are Latin-only.

**Why not name the variable `--font-sans` directly:** that was the first attempt, and it worked *by accident*. Tailwind v4 defines `--font-sans` as a theme token containing the system stack, and next/font defines its variable on a class on `<html>` — which is also `:root`. Same element, same specificity, so the winner was whichever rule Next happened to emit later in the bundle. Inter won, but nothing guaranteed it would keep winning across a Next or Tailwind upgrade. Giving the font its own name and explicitly overriding the token means one variable has one owner.

**Revisit when:** a serif for article bodies is wanted — add a second `next/font` call and scope it to `.prose` rather than swapping this one.

## 19. Blur-up placeholders as CSS backgrounds, generated in sync-assets (2026-07-26)

**Decision:** `scripts/sync-assets.mjs` shells every raster vault image through sharp at 16px and writes `.blur-manifest.json` (public URL → ~150-byte base64 WebP). `lib/blur.ts` reads it at build time; `ShelfCard` and `PeopleCards` set the placeholder as the `<img>`'s own `background-image`.

**Why background-image and not a second element:** the real image paints over its own background as soon as it decodes, so there's no swap to orchestrate — no client JS, no `onLoad`, no state, and nothing to go wrong with `loading="lazy"`. `background-size` mirrors the card's `object-fit`, or a `coverFit: contain` image would sit on a stretched blur.

**Why the values are passed as props:** `lib/blur.ts` touches `fs`, and `PeopleCards` renders inside a client component. Importing it there would drag the server chain into the browser bundle — the same failure as decision #15.

**It can never break a build:** if sharp is missing or an image is unreadable, that key is simply absent and the card renders exactly as before. sharp is now declared in `devDependencies` rather than relied on as a transitive Next dependency — **run `npm install` once** to record it.

## 20. Entry footers carry prev/next only (2026-07-26)

**Decision:** `lib/siblings.ts` gives each entry the notes either side of it, using the ordering `getEntries()` already produces. Rendered by `components/EntryFooter.tsx` as a single row — a chevron at each edge of the column, the neighbour's title filling inward.

**Related-by-category was built and removed the same day:** it ranked same-section notes by shared `categories:`. The owner's call was that categories are already surfaced everywhere else — as chips on the entry, on the section list, and as their own pages on the shelf — so a "Related" block restated what the reader could already see, and cost a card-sized chunk of vertical space to do it.

**Why the row is shaped this way:** the first version was two bordered cards stacked under the article, which added ~140px of height to every page. The arrows-at-the-edges form is one line, and reads as navigation rather than as more content. Titles always render and ellipsis when short on room; "Previous"/"Next" survive as `sr-only` text, since an arrow alone means nothing read aloud.

**Revisit when:** sections grow large enough that stepping one note at a time stops being useful.

## 21. Backlinks reverted — decision #16 is no longer in effect (2026-07-26)

**Decision:** the "Mentioned in" block is off entry pages. `lib/backlinks.ts`, `components/Backlinks.tsx`, the `mentionedIn` string and the `.backlinks*` styles were all deleted the same day they were added, at the owner's request.

**Why it's recorded rather than quietly dropped:** #16 above reads as live architecture otherwise, and the next person to touch the entry page shouldn't go looking for a module that isn't there.

**Bringing it back:** the reasoning in #16 still holds — the inversion is ~60 lines on top of `getWikiIndex()`, and the deleted files are in git history at the preceding commit. Entry footers now carry related entries and prev/next only (#20).

## 22. Quotes are a synthetic shelf category (2026-07-26)

**Decision:** `/shelf/type/books/quotes` is a real static page, but "Quotes" is not a real category — it comes from the blockquotes inside book notes (`lib/quotes.ts`), not from `categories:` frontmatter. The chip renders last and only when quotes exist; the route resolves it before `categoryFromSlug()`, which would never find it.

**Why a category rather than its own page:** it belongs next to the books it came from, and reusing the medium page means the chips, count and heading all work with no new layout. `QuotesView` replaces the cover grid because the passage is the content — a grid of covers would bury it.

**Bilingual pairing is by index, and refuses when the counts differ.** Attaching translations positionally is only safe when both bodies quote the same number of passages; otherwise the quotes are shown in English only rather than mismatched.

**One thing that was tried and removed:** stripping a trailing "— Attribution" from each quote. It also ate the second half of any quote containing an em dash. Quotes are now stored verbatim — silently truncating someone's words is much worse than an occasional redundant byline.

## 23. Spoilers and status rows (2026-07-26)

**Spoilers** are a checkbox and its label (`||inline||`, and `> [!spoiler]` for a block), so they reveal with no JavaScript and never render as a dead control. In Obsidian a spoiler callout is just an ordinary callout. Their ids run through the same `idPrefix` as headings — both languages ship in one document, so an unprefixed id would have made the English spoiler toggle the Ukrainian one.

Both kinds toggle **both ways**, but they get there differently. The inline label wraps its own text, so clicking a revealed one hides it again. The callout can't: its label is a transparent cover laid over the body (a `<label>` takes only phrasing content, and the body is arbitrary markdown), and that cover is `display: none` once revealed so the text stays selectable and links inside it work. The way back is a **second label on the same checkbox — the callout title**, which sits outside the blur, is always present, and isn't something you click by accident while reading. A small "Hide" appears beside it only once the body is showing. The focus ring follows the same logic: it rides the cover while hidden and the title once revealed, because the cover is gone by then and a ring on a `display: none` element is no ring at all.

**Shelf status rows** (`shelfHighlights()`) are deliberately separate from `shelfGroups()`. They're display-only and must never reach `shelfMediumSlugs()`, or "In progress" would generate a page at `/shelf/type/in-progresses`. Items appear both in a status row and in their medium row, which is how every streaming shelf behaves.

## 24. Note maturity defaults to seedling (2026-07-26)

**Decision:** `maturity: seedling | budding | evergreen` on an entry; anything unset or unrecognised falls back to seedling, so every note shows a badge from day one rather than the feature being invisible until the vault is retagged.

**Why it's on posts only:** it rides with the reading stats, which are already posts-only. A book on a shelf doesn't have a draft stage.

## 25. The résumé is frontmatter on the Now page, and the PDF is generated from it (2026-07-26)

**Decision:** the résumé lives in a `resume:` key in `vault/Now/main.md` and renders through `components/Resume.tsx`, which `NowList` mounts under the status cards. It is not a section type, not an entry, and not a page of its own.

**Why it sits on Now:** a résumé answers the same question the Now page does — what is he doing at the moment — and the two would go stale together if kept apart. Structured frontmatter (the same escape hatch `music` uses for `playlists:`) keeps every string translatable via `_uk` siblings, which a markdown body could not do without a second file to maintain.

**`scripts/build-resume-pdf.py` reads that same frontmatter** and renders the downloadable PDF with WeasyPrint, so the page and the file can't drift. It is run by hand, not wired into `prebuild`: it needs Python and WeasyPrint, and a missing dependency must never be able to break `npm run build` or a Vercel deploy. The generated PDF sits in `vault/Now/`, so `sync-assets.mjs` publishes it and `getAssetIndex()` resolves the download button's href.

**No phone number and no street address anywhere in this repo.** The PDF is downloadable from a public page, so it carries exactly what the page carries: email and city, both read from `contact:` in the frontmatter. A first version kept them in a `PRIVATE` dict inside the script, reasoning that the PDF is what employers see — but the PDF *is* the public page, so that only moved the exposure one click away. Add personal contact details by hand to a copy sent to an employer.

**Bullet convention:** points are plain strings written `Label — detail`; the component and the PDF script both split on the em dash to bold the lead-in. Keeps the frontmatter readable in Obsidian instead of nesting an object per bullet.

**The résumé's block list is shared, not duplicated (2026-07-26):** `lib/resume.ts` holds one ordered list — id, bilingual label, "does this block render" check — for Experience, Education, Certifications, Strengths, Languages, Contact. Three consumers read it: `components/Resume.tsx` (renders each block under that id), `components/lists/NowList.tsx` (feeds the same ids/labels to `<Toc>`, exactly like an entry page's markdown-heading outline — see decision #17), and `lib/vault.ts`'s `getSearchIndex()` (jump-to-anchor Cmd+K results, the résumé equivalent of `headingItems()`). A résumé block has no markdown heading to collect ids from — the page's own body is deliberately empty — so this list is what a `rehype-slug` pass would otherwise have produced.

**`/resume` redirects to `/now` (2026-07-26)** via `next.config.ts` → `redirects()`, resolved into the build-time routes manifest rather than a page component — no server, no middleware, consistent with decision #5. It is not its own section: a real `/resume` page would fork the résumé from the Now page it's meant to stay in sync with.

**Search gets a dedicated "Résumé" result, separate from its block headings:** typing "resume" wouldn't otherwise match anything, since the section itself is titled "Now" / "Зараз" — nothing in the index contained the word. The item's `text` is every string in the `resume:` frontmatter (`resumeSearchText()`), so free-text queries like "Starbucks" or "Tim Hortons" also surface it. It links to `#resume`, an id on the block's own wrapper — landing there rather than at the page top skips past the status cards.


**The top of the Now page is a goals checklist, not a status list (2026-07-26):** `goals:` frontmatter replaced the earlier `items:` key. The old cards (studying for Security+, starting TMU, working at Starbucks, building this site) described *current* status, which the resume block below already covers in more detail — the two were saying the same thing twice. Goals describe what hasn't happened yet, which is a distinct kind of content this page didn't have: "Pass the CompTIA Security+ exam," "Land a co-op placement in first year" (with a `note:` for the 3.0 GPA requirement), "Find a tech-related job." Each goal is a checkbox card — hollow border for open, filled with a checkmark once `done: true` is set by hand in Obsidian — reusing the resume timeline's own filled-vs-hollow dot convention (this decision, above) rather than inventing a second visual language for "in progress" on the same page.
## 26. The Now page is written as markdown, not YAML (2026-07-26)

**Decision:** the goals checklist and the résumé live in the *body* of `vault/Now/main.md` — a task list and `####` headings — and `lib/now-content.ts` parses them back into the same `goals` / `resume` structures the page has always read. Frontmatter keeps only flat keys (`title`, `updated`, `resume_file`, …). Ukrainian moved to a sibling `main.uk.md`, the same split every other section body already uses.

**Why:** decision #25 chose frontmatter so every string could carry a `_uk` sibling "which a markdown body could not do without a second file to maintain." That trade turned out to be backwards. The second file is cheap — sections already support `main.uk.md` — while nested YAML is something Obsidian genuinely cannot edit: the Properties panel only handles flat keys, so a 116-line frontmatter block meant editing raw YAML in source mode with no checkbox to click and no heading to fold. The vault is supposed to be the CMS. Now checking off a goal is checking off a checkbox.

**Nothing about the rendered page changed.** The parser was verified by building the site before and after and diffing the generated `/now` and `/` HTML: byte-identical apart from Next's per-build id. Two shapes shift internally and render the same either way — rows now fill `meta` where they used to fill `note` (`components/Resume.tsx` reads `meta ?? note`), and a Ukrainian string identical to its English twin is dropped rather than stored, which `components/T.tsx` already collapses.

**The format:** `## Goals` holds a task list — `[x]` is `done:`, an indented bullet is the sub-label, and a trailing `→ [[Note]]` is the link. `## Résumé` holds its summary paragraph, then one `###` per block (named exactly as the page prints them, in either language) and one `####` per timeline row: `Role · Org` in the heading, then `*period* · sub-label` with the period in italics because that's the one field that can't be told apart from a location by shape alone. `#current` — a real Obsidian tag, so it's visible and clickable while editing — fills the dot.

**Values merge by position, and English is authoritative.** `main.uk.md` supplies translations only: flags, links and the PDF file name are read from `main.md`, so a Ukrainian file that drifts structurally can mistranslate a label but can never change what the page does. A count mismatch between the two files warns in the build log.

**Parsing is forgiving on purpose.** An unrecognized heading is skipped with a `console.warn`, never thrown. A typo in a note must not be able to fail a Vercel build — that would hold back every other content change in the same push, whereas a missing block is visible on the page the moment it's opened.

**`scripts/build-resume-pdf.py` gained a ~60-line English-only twin of the parser** rather than importing anything from the TypeScript side: it already had its own renderer, and the alternative (having Node emit JSON for Python to read) puts a build step between the note and the PDF. Verified the same way — the dict it now parses is identical to the one it used to load from YAML.

## 27. Sections can have subfolders; they mean nothing to the URL (2026-07-26)

**Decision:** `getEntries()` walks a section's subfolders, so `vault/Shelf/Books/Sapiens.md` is an entry exactly as `vault/Shelf/Sapiens.md` was. The shelf is now filed by medium (`Books/`, `Movies/`, `Shows/`, `Videos/`), each note's cover beside it, and the loose media under Posts moved to `Posts/attachments/`. Only top-level folders of `vault/` are scanned by `getSections()`, so a subfolder can never become a page.

**URLs are untouched, and that's the point.** A slug comes from the file name, never the path — `/shelf/sapiens` before, `/shelf/sapiens` after. Filing is an Obsidian-side concern (16 shelf notes and 13 covers in one flat folder was the actual complaint), and it has to stay one, or reorganizing a vault would silently break every link and every search result pointing at it.

**Three things had to move with it:**

- `resolveCoverUrl()` used to build `/vault-assets/<section>/<file>` by string concatenation, which 404s the moment the cover isn't directly in the section folder. It now resolves like an image embed does — the note's own folder first, then vault-wide by file name — so `cover: sapiens.jpg` finds the file wherever it is. `entry.sectionDir` carries the note's real folder (`Shelf/Books`) for the same reason.
- **Entry sort got a title tiebreak on equal dates.** Every shelf note shares one of two dates, so their order came out of `readdir()` — filesystem order, which differs between a laptop and the Vercel builder and shifted again when the notes moved into folders. Nothing visible depended on it (rows are grouped and sorted downstream), but the Cmd+K index did.
- **`entryMedium()`** reads `medium:` frontmatter and falls back to the folder name (`Movies/` → `movie`), so a note dropped into the right folder needs no frontmatter to appear in the right row. Frontmatter always wins; only folder names that name a known medium count, so `attachments/` or `Drafts/` stay inert. The four readers of `entry.meta.medium` (shelf, quotes, JSON-LD, entry page) share it.

**Verified by building before and after and comparing all 52 prerendered pages: every one renders an identical DOM.** The only intended differences are asset URLs, which now carry the subfolder (`/vault-assets/Shelf/Books/sapiens.jpg`), plus one hard-coded link in the war-newspaper post that had to be repointed at `Posts/attachments/`. Nothing links to those asset paths from outside the site.

**Not done: renaming files to match.** Covers keep their download names (`the-last-wish.jpg`) and notes keep their titles. The folder already says what a thing is; renaming would churn the git history for nothing.

**Second pass, same day:** covers moved out of the note folders into a `covers/` subfolder per medium (`Shelf/Books/covers/`), which halves what you see when you open Books — 22 notes instead of 33 mixed files. `cover: sapiens.jpg` still finds it: the file name alone is enough, since resolution falls back to the vault-wide asset index. `Projects/attachments/` matches `Posts/attachments/`, and the three scaffolding notes (Post Sample, Formatting playground, Draft example) moved to `Posts/Examples/` — still published, still at their old URLs, just not sitting among real writing. Two opaque file names were fixed at the same time: `IMG_3260.jpeg` → `me.jpeg` and `fedorov.png` → `mykhailo-fedorov.png`, with their two embeds and one `cover:` key updated. All 52 pages verified to render an identical DOM afterwards.

## 28. Footnotes render twice — as sidenotes and as a list (2026-07-27)

**Decision:** an Obsidian footnote (`[^1]`) is emitted both as the list remark-gfm builds at the bottom of the note and as a `<span class="sidenote">` in the left margin, inserted right after its reference by `rehypeSidenotes` in `lib/markdown.ts`. CSS shows exactly one: the margin copy from 1280px up, the bottom list below it and in print.

**Why duplicate rather than move.** A sidenote is a layout idea, not a content one, and this site has to keep working without JavaScript, in an RSS reader, and on paper — all places where "the margin" doesn't exist. Rendering both and letting a media query pick is the same show-one-hide-the-other trick `components/T.tsx` already uses for the two languages, and it means the `↩` backref keeps working for anyone who arrives at the bottom list from a narrow screen. The duplicated text is not indexed twice: Cmd+K is built from the raw markdown (`getSearchIndex()`), not from this HTML.

**Left margin, because the right one is taken.** `components/Toc.tsx` appears at exactly the same 1280px breakpoint on the right. The sidenote's geometry is derived from the rail's so the two sit the same distance out from the text column — see the comment in `globals.css`.

**Only all-paragraph footnotes are converted.** The sidenote lives inside the `<p>` holding its reference, so its contents must be phrasing; a footnote containing a list or a code block would serialize to invalid HTML that the browser silently reparses into a different tree. Those are skipped, and one skip drops the `all-sidenoted` class so the bottom list stays visible at every width. The feature degrades a note at a time, never loses one.

**Two id namespaces had to be fixed for the bilingual build.** Both languages ship in one document (decision #17), and footnote ids are minted from the note's own numbering, so the Ukrainian body was redefining every English `user-content-fn-N`. `remark-rehype`'s `clobberPrefix` now carries the same `uk-` prefix the headings use. Its screen-reader-only `<h2 id="footnote-label">` is not covered by that option, so `rehypeSidenotes` renames it and repoints every reference's `aria-describedby` (stored by hast as a token *array*, not a string). That heading is also skipped by `rehypeHeadings` — it isn't part of a note's outline, and anchoring it put "Footnotes" in the table of contents and in Cmd+K.

## 29. Selecting text offers a link to the selection (2026-07-27)

**Decision:** selecting a passage inside `.prose` raises a pill that copies a URL with a **text fragment** (`#:~:text=…`) — `components/SelectionLink.tsx`.

**Why a fragment and not an anchor:** the site is fully static (#5) and the vault has no stable per-sentence id to point at. A fragment is derived from the words themselves, so nothing is stored, nothing needs regenerating when a note is edited, and a browser without support (Firefox, currently) still opens the right page. Long selections are linked by their first and last five words rather than in full, which keeps the URL short and survives a light edit in the middle.

**`?lang=` was added for it, and is always written — including `?lang=en`.** Language is a client-side preference with no routing (`components/T.tsx`), so a Ukrainian passage shared as a bare URL would open in English, and the fragment — matching words that are `display: none` — would highlight nothing. Omitting the param for English looks tidier and is wrong for the same reason in reverse: a reader whose stored preference is Ukrainian would open an English link in Ukrainian and match nothing. A shared link pins the language it was written in rather than inheriting the reader's. The pre-paint script in `app/layout.tsx` lets the URL win over the stored preference **without writing it back**: a link someone followed once shouldn't silently change the language of every page they read afterwards.

**What it does not do is translate.** A link made from a Ukrainian sentence lands on the Ukrainian page, not on the English counterpart of that sentence — there is no sentence-level alignment between a note and its `.uk.md` sibling, and nothing in the pipeline builds one. Only headings are positionally aligned between the two files, so the most a cross-language jump could ever be is section-accurate. Not built; the note is here so the next person doesn't rediscover the constraint.

**Pointer devices only,** like the hover previews (#12): a touch selection already raises the OS's own share sheet, and a floating button fighting it is a fight nobody wins.

## 30. The lightbox is a gallery (2026-07-27)

**Decision:** opening a figure collects every other visible figure on the page in document order, so ← / → (and on-screen arrows, shown only when there's more than one) step through a note's images without closing and reopening.

**The list is rebuilt on every open, never cached.** The language toggle hides half the document with `display: none`, and a note's Ukrainian copy of a figure must not turn up in the middle of an English reader's gallery — so the collector filters on what is actually laid out (`offsetParent` / `getClientRects()`), which is only knowable at the moment of the click.

**Arrow keys are bound only while the overlay is open,** so they keep their normal meaning — caret movement, browser history — on the page itself.

## 31. Vercel Analytics, and nothing else (2026-07-27)

**Decision:** `@vercel/analytics` is mounted in the root layout. Page views only, no cookie, no cross-site identifier, so there is no consent banner to add and nothing about the site stops being static.

**It puts one `BAILOUT_TO_CLIENT_SIDE_RENDERING` template in every prerendered page** — the component reads the search params, so its own subtree renders on the client. Verified that this is all it does: all 52 pages were diffed against a build from before, and apart from that placeholder and the new footnote markup, every one is byte-identical.

## 32. Image dimensions come from the same pass as the blur placeholders (2026-07-27)

**Decision:** `scripts/sync-assets.mjs` now records each raster image's real pixel size alongside its placeholder, in a manifest renamed `.image-manifest.json`. A rehype step (`rehypeImageSize` in `lib/markdown.ts`) stamps `width`/`height` onto every content image that doesn't already carry them.

**What it fixes:** an `<img>` with no intrinsic size occupies zero height until it decodes, so every image on a page shoves the text below it down on arrival — on a slow connection the paragraph being read slides out from under the reader. With the attributes present, the existing `max-width: 100%` + `height: auto` in `globals.css` turns them into an aspect ratio and the box is reserved at the right shape from first paint.

**A rehype step, not a change to the `<img>` builders**, because images reach the tree three ways: Obsidian embeds (raw HTML from `preprocessObsidian`), standard markdown (built by remark), and hand-written tags in a note. One step after `rehype-raw` sees all three. Explicitly sized embeds (`![[me.jpeg|93]]`) are left alone — that syntax has already said what it wants, and overriding it would un-crop the avatars.

**One manifest, not two:** sharp is already opened per image for the placeholder, and `metadata()` is free at that point. The two reads are independent, so an image sharp can measure but not re-encode still contributes its dimensions. Missing manifest, missing sharp, or a corrupt file all degrade to exactly the previous behaviour.

**Not done: shrinking the files themselves.** Measured while adding this — 4.3 MB of raster in the vault, and the worst offenders are a 1000×1000 PNG photograph at 1.3 MB (should be a JPEG or WebP, and is a `cover:` on a page that shows it small), a 1218×1218 avatar at 203 KB that renders at 93 px, and book covers at 1706×2504 that render about 200 px wide. Fixing that properly means serving derivatives rather than the vault's own files, which changes what every asset URL points at. Deliberately left for a separate decision.

## 33. Speculation rules prefetch, never prerender (2026-07-27)

**Decision:** the layout ships a `speculationrules` script that **prefetches** same-origin documents at `moderate` eagerness (roughly: the pointer has settled on a link).

**Prerender was the obvious choice and is the wrong one here.** Prerendering also *runs* the page, and `@vercel/analytics` (decision #31) does not check `document.prerendering` before reporting — checked, the string appears nowhere in the package. Every hovered link would have counted as a visit, and the analytics would have quietly become fiction months before anyone noticed. Prefetch moves bytes and executes nothing.

**The win is real but small, and worth writing down so it isn't re-litigated:** Next already prefetches route payloads for in-app clicks, so this only covers what its router never sees — a middle click, a new tab, the first navigation after landing. It was cheap and it is not a substitute for making the images smaller.

## 34. Keyboard shortcuts read the page instead of being handed it (2026-07-27)

**Decision:** `components/Shortcuts.tsx` binds `[` / `]` (previous / next entry), `g` then `h` or `1…9` (home, or the nth section in sidebar order), `/` (search) and `?` (the cheat sheet).

**Prev/next is looked up in the DOM** — `a.sibling-prev` / `a.sibling-next`, the links `components/EntryFooter.tsx` already renders from `lib/siblings.ts`. The component is mounted globally, where per-entry data doesn't exist, and threading those two hrefs down through the layout would create a second source of truth that can disagree with the visible links. Same event-delegation approach as `Lightbox` and `CodeCopy`.

**Digits, not initials.** Posts, People and Projects all begin with P. Any letter scheme either collides or needs a hand-maintained table that goes stale the moment a section is added to the vault; the numbers follow the nav order the sidebar already shows, and the sheet prints the real names beside them.

**The listener must not be re-subscribed on render.** A half-typed `g` lives in the handler's closure, so `sections` is memoized and the handler never reads `sheet` state (Escape closes unconditionally — a no-op when it's already shut). Chrome memoizes the `onSearch` it passes for the same reason. Keys are ignored while typing in a field or with a modifier held.

## 35. Cmd+K runs commands, not just searches (2026-07-27)

**Decision:** the palette's list now holds actions as well as pages — switch language, copy the page as Markdown, copy a link to it, open a random note — matched by the same query and reachable with the same arrow keys.

**Pages always sort above actions.** Typing a note's name has to open the note; a command sharing a word with it must never intercept that.

**"Copy as Markdown" clicks the existing button** (`button.copy-md`) rather than receiving the note's source. The palette is global; passing every entry's raw markdown into it would put that text in the page a second time, and the button already handles picking the right language. The action hides itself when no such button is on the page.

**`when` can only be asked in the browser.** A client component is still rendered once on the server to produce the static HTML, and a DOM check there threw during the build. Guarded rather than deferred to an effect: the palette renders nothing until it is opened, which cannot happen before hydration.

**Left alone: the reading progress bar.** The plan had been to replace its scroll listener with a CSS scroll-driven animation. It measures the *article* and stops early at a closing "Sources" heading, and neither behaviour survives `animation-timeline` — CSS can only measure a box. Worth noting that images inside the article *do* currently count toward the bar; whether they should is a separate question about what "progress" means, not a performance one.

## 36. The reading bar pauses at media rather than being driven by it (2026-07-27)

**Decision:** every block counts toward the article's length, media included, but *when* a block pays out differs. Text pays out continuously — crossing half a paragraph advances the bar by half that paragraph. A figure, embed or diagram pays out **all at once at its bottom edge**: while it's passing the bar holds still, and when it has finished it takes its whole height in one step. With the easing below, that step reads as a glide rather than a jump.

**Media is worth half a pixel to prose's one** (`MEDIA_WEIGHT` in `lib/reading-progress.ts`). A full-width image is several times the height of the paragraph introducing it and nowhere near several times the attention, so counting it one-for-one made a photo-essay's bar almost entirely picture: on the war-newspaper post, text accounted for 15% of the bar at full weight and 26% at half. The constant is one number with the two extremes covered by tests — raise it toward 1 to track the page more literally, drop it to 0 to ignore media entirely, which is what the version before this did.

**Why not simply exclude media** — which is what that first version did. Dropping figures from the total made the bar honest about reading but wrong about the article: the war-newspaper post is nine full-page scans, and a bar that ignored them was measuring a small fraction of the page while the reader scrolled through all of it. Between two scans sat a one-line caption that moved the bar a tenth of its length, because that caption was a tenth of everything being counted. Holding at each image and paying out afterwards keeps both properties: the scans are part of the journey, and no amount of scrolling past artwork *drives* the indicator.

**The read line is the TOP of the viewport, and the finish line is the article's end reaching the BOTTOM of it** (`finishAt()`). A block pays out as it scrolls off the top, so the bar answers "how much have I put behind me", and it completes when the last line comes into view rather than a screen-height later.

**Both halves of that were arrived at by getting them wrong.** Measuring at the bottom edge — "how much have I *seen*" — opens the bar a quarter full on a tall screen, because a quarter of the article is genuinely visible before any scrolling. The fix for that was to subtract whatever the first screenful was worth, which is correct arithmetic and a much worse bug: an opening that fits on one screen is then declared read before the reader has scrolled, so scrolling through it earns nothing. On the war-newspaper post the entire introduction — the paragraph that gives the piece its title — was worth **0%** of the bar, and the symptom was invisible unless you happened to watch the bar during the opening. Measuring at the top edge needs no correction term: at scroll zero nothing has passed, so the bar starts empty by construction.

**Both failure modes are now regression tests** (`progress starts at zero on any viewport`, `an opening screenful still counts`), along with a monotonicity check — none of these can be caught by looking at a built page, only by reading the numbers back.

**`finish` is measured in `measure()`, not per frame** — it only changes when the layout does, and that function already runs on exactly those occasions.

**The arithmetic moved to `lib/reading-progress.ts` and is tested.** It is the one behaviour on this site that can't be checked by looking at a built page: a wrong answer shows up only as a bar filling at the wrong rate. `npm test` runs Node's own test runner over `lib/*.test.ts` — no framework, no dependency, nothing to keep up to date. (`allowImportingTsExtensions` is on so Node's type stripping can resolve the import; nothing is ever emitted.)

**Cheaper per frame than the version it replaces, not more expensive.** The old one re-read the article's geometry on every animation frame; this measures once and caches, and a `ResizeObserver` on `.prose` re-measures when lazy images or embeds arrive and shift what's below them. A scroll frame is now one number and two style writes.

**Motion is deliberate.** The bar eases toward the scroll position rather than tracking it exactly (`EASE = 0.18`), so it keeps gliding for a moment after the scroll stops — that trailing motion is most of what makes it feel attached to the page rather than snapped to it. A point of light rides the leading edge, and the whole bar fades in only once there is progress to report, so a short page never shows a stub. All of it collapses under `prefers-reduced-motion`: no easing, no glow.

**Implementation notes worth keeping:** the component writes one custom property, `--p`, and both child elements read it, so a frame does no layout and no paint beyond the compositor. The glow sits outside the scaled fill — inside it, it would be stretched into a smear at low progress — and is positioned with `left: calc(var(--p) * 100%)` rather than a `translateX` of `100vw`, because a percentage translate resolves against the dot's own 2px width and `100vw` counts a scrollbar the bar itself doesn't. `contain: layout` keeps that `left` from being able to touch the page.

## 37. `l` switches language, and the resistance line is a donation link (2026-07-27)

**`l`** joins the shortcuts in decision #34. `useLang`'s `setLang`/`toggle` are now memoized: `Shortcuts` keeps `toggle` in a key-listener dependency array, and a fresh function each render would tear that listener down, taking any half-typed `g` chord with it.

**The sidebar's "Day N of Ukraine's resistance" links to a monobank jar** (`DONATE_URL` in `components/ResistanceDay.tsx`), styled as nothing at all — inherited colour, no underline, no hover state, no external-link marker. The sidebar looks exactly as it did. That's the point: it's a quiet offer to anyone who thinks to click the line, not a call to action bolted onto a statement.

## 38. Motion pass: entrances, edges, and one marker that moves (2026-07-27)

Four small movements, each solving a legibility problem rather than decorating one. Every one of them is off under `prefers-reduced-motion`.

**Lists arrive one item at a time** (`.stagger` in `globals.css`). The delays are `nth-child` rules rather than an inline `--i` per row, so a list component gains a class name and no server-rendered `style` attributes; delays cap at twelve items and every later row shares the last one, so a long archive doesn't take three seconds to finish. Applied to posts, people, the shelf rows, the medium grids and the projects feed.

**The reduced-motion override is `animation: none`, not a shorter duration.** The blanket rule at the top of `globals.css` collapses `animation-duration` only, and these run with `both` fill from `opacity: 0` — so a shortened animation still leaves each row invisible for the length of its *delay*. Under the blanket rule alone the twelfth row would have blinked in a third of a second late, which is precisely the effect someone enabling that setting is trying to avoid. Print gets the same override for the same reason.

**Shelf rows fade at whichever edge has more to come** (`components/lists/ShelfRow.tsx`). The row hides its scrollbar, which looks clean and removes the only signal that it continues off-screen; material dissolving at the edge puts that signal back without adding a control. A row whose contents fit fades neither edge — a fade at the last cover of a short row suggests content that isn't there.

- **The mask is on a wrapper, not on the scroller.** A mask on a scrolling element travels with its content, so the fade would slide away with the covers instead of staying at the edge.
- **A client component for four lines of state, deliberately.** The CSS-only version is a scroll-driven animation (`animation-timeline: scroll()`), which is lovely and Chromium-only today — on Safari and Firefox the rows would keep exactly the problem this exists to fix. Revisit when those timelines are broadly supported.
- Snapping moved from `snap-mandatory` to `snap-proximity`: mandatory fights a reader who wants to nudge a row a little.

**The table of contents highlight is one marker that slides** rather than a border switching on and off per row. Its position is read from the live DOM (`offsetTop`/`offsetHeight` of the active link) rather than computed from the heading list, because both languages' outlines are in the rail with one of them `display: none`, rows wrap to two lines at some titles, and the rail itself scrolls — the element's own offsets already account for all three. **Both outlines mark the same heading active**, so the lookup takes the first match that is actually laid out; matching the hidden one parks the marker at zero. The mobile sheet keeps the old per-row border: it has no marker, and a panel you just opened has nothing to slide from.

**Dialogs animate out as well as in.** The drawer already did — it was always mounted and translated. The command palette, the shortcut sheet and the mobile contents sheet were conditionally rendered, and React cannot transition an element it has already removed, so they could only ever blink. They now stay mounted and are shown by `data-open`, with `visibility` in the transition (delayed on the way out so the fade finishes first) and `inert` when closed to keep them out of the tab order and the accessibility tree.

**Their contents still wait for the first open.** Keeping three dialogs mounted put ~11 KB of markup into every page's static HTML — the palette's default eight results, the shortcut table, and a third copy of the note's outline — for panels most readers never open. An `everOpen` flag renders the contents on first open and keeps them afterwards, so the exit animation still has something to animate. Down to ~2.8 KB per page, which is the rest of this session's work rather than the dialogs.

## 39. Scoped search, remembered position, and a link to the source (2026-07-27)

**`>` scopes Cmd+K to the page you're on** — its own entry plus every heading in it, and `>` alone prints the note's outline. A long note is the one place where the global index is the wrong index: you know which note you're in, you just can't find the section. A prefix rather than scoping automatically on long pages, because an implicit mode that silently hides most of the results is worse than one keystroke. The footer says which mode you're in.

**"Open this note on GitHub"** links at the note's raw vault source, in whichever language is being read (a note without a translation falls back to the English file). `repoUrl`/`repoBranch` live in `lib/site-config.ts` beside the socials; clear `repoUrl` and the action disappears. The path comes from `data-vault-source` on the entry page's wrapper — the same read-the-page approach as the prev/next shortcuts (#34), and for the same reason: the palette is global, and threading every entry's file path through the layout would create a second source of truth.

**Reading position is remembered, and never restored automatically** (`components/ReadingPosition.tsx`). Auto-scrolling is the version of this everyone builds first and everyone regrets — you open a link someone sent you, read two lines, and the page throws you into the middle of a paragraph you don't recognise. It offers, in a pill you can ignore, and it hides itself as soon as you start reading anyway.

**The pill is the contents pill.** Same chip as `.toc-bar` — rounded-full, translucent, blurred — and from 1280px it sits at the foot of the same column the contents rail occupies (`left: calc(50% + 22rem)`, matching `.toc-rail` exactly) rather than out at the window's edge. Below that breakpoint it takes the bottom-right corner, since the contents pill owns the bottom-left. One label, "Continue" / "Продовжити", with an open-book icon carrying the rest of the meaning; no dismiss button, because matching that pill means one control and the offer already withdraws itself the moment you scroll. Escape closes it for anyone who wants it gone without moving.

**It stays quiet unless all four hold:** you're more than a screen and a half in (shallower than that and scrolling finds it faster than reading a prompt), you arrived at the top (so it can't argue with the browser's own scroll restoration on a back-navigation), the URL carries no `#heading` (already an instruction about where to land), and the note is still longer than the saved offset (if it isn't, it's been rewritten and the number is meaningless).

**One localStorage key holds a map of path → position**, pruned to the twenty most recent and thirty days. A key per note would leave a pile in the reader's browser that nothing ever cleans up.

**Saving is debounced and separate from the scroll handler.** The first version read, parsed and wrote the whole map inside the scroll callback, which is precisely the kind of synchronous work that makes a page feel heavy while scrolling. The position only has to be correct when the reader stops or leaves, so it writes 400ms after scrolling settles, on unmount, and on `pagehide` — which covers closing the tab, going back, and iOS suspending it, none of which `beforeunload` reliably does.

## 40. BreadcrumbList, and the bug it turned up in reading position (2026-07-27)

**`breadcrumbJsonLd()` emits the trail from the site root to the current page**, on section pages and entry pages. It's what lets a search result print "kryloss.com › Posts › Security+ journey" instead of a bare URL. Two levels is the whole hierarchy: a note's subfolder is filing, not structure, and deliberately isn't in its URL either (#27) — putting it in the trail would describe a path that doesn't exist. The last crumb carries no `item`, per schema.org's guidance, since it would link to itself. Home emits none: it's the root of every trail and has none of its own. English names only — a crumb is one string, both languages ship in the same document, and English is what the canonical URL already uses.

**Reading position (#39) never worked, and the reason is worth recording.** `persist()` read `window.scrollY` at the moment it ran, and it also runs on unmount. On an in-app navigation the router has already scrolled the window back to the top by then, so leaving a note saw `0`, decided the reader had "started again", and deleted the mark — every note, every time. The fix is to persist the last position observed *by the scroll handler* rather than a live read.

**A third, and the one that actually kept it invisible: React StrictMode.** The App Router's dev server mounts every component, unmounts it, and mounts it again. `persist()` runs on unmount — so *arriving* at a note ran the cleanup immediately, at `scrollY: 0`, which read as "started again" and wiped the mark before the offer could be made. In development the feature deleted its own data on arrival, every single time. It now tracks whether the visit produced a scroll at all, and writes nothing — and, crucially, deletes nothing — without one.

**Verified in a real browser this time, not by reading the code.** Chromium wouldn't run in the sandbox (an arm64 host, and the bundled builds were x86-64), which is why the first two fixes shipped on reasoning alone and neither of them worked. Playwright's arm64 Chromium plus hand-extracted system libraries got a browser running against `next dev`, at which point the round trip — open, scroll, leave, return, click — could be watched rather than assumed. The negative cases were checked too: a shallow scroll isn't remembered, a `#heading` in the URL suppresses the offer, scrolling on your own dismisses it, and returning to a note near the top clears the mark rather than offering to send you back two lines.

**A second, quieter version of the same mistake:** the decision about whether to offer at all checked `window.scrollY < 100` synchronously on mount, which on a client-side navigation can still be reading the *previous* page's scroll position. That check now waits a frame.

Both are the same class of bug — treating the scroll position as a fact you can read at any time, when during a navigation it belongs to a page that no longer exists.

## 41. A video is only a VideoObject once it can prove it (2026-07-30)

Search Console reported three Videos structured-data issues on the site — "Missing field `thumbnailUrl`", "Missing field `uploadDate`", and "Either `contentUrl` or `embedUrl` should be specified" — one per note in `vault/Shelf/Videos/`. The cause was `shelfType()` in `lib/jsonld.ts` mapping `medium: video` to `VideoObject` and then filling in the same generic fields it uses for a book: `name`, `description`, `image`, `author`. `VideoObject` has required properties that a `Book` doesn't, and Google treats a partial one as an error rather than ignoring it — so the markup was strictly worse than no markup at all.

**Type is now decided by what the note can actually supply, not by its `medium:`.** `videoObject()` builds the complete object — `name`, `description`, `thumbnailUrl`, `uploadDate`, `embedUrl` — or returns null, and null falls back to `CreativeWork`. Nothing can emit a half-populated `VideoObject` any more, which is the property worth keeping: the next medium added to the shelf can't reintroduce this bug by accident.

**`uploadDate` is a new `uploaded:` frontmatter key, because it's the one field the site can't derive.** The thumbnail comes free from the video ID and the embed URL is a string template, but a video's publication date needs the YouTube Data API — a key, a quota, and a build-time network call, all of which the shelf deliberately does without (it runs on oEmbed and `i.ytimg.com` alone). The note's own `date:` is *not* a stand-in: that's the day it went on the shelf, and using it would state something false about someone else's video to a search engine. So it's asked for and written down, and a note without it simply doesn't claim to be a video.

**`embedUrl`, not `contentUrl`.** `contentUrl` wants an actual media file; YouTube doesn't hand one out. `embedUrl` points at the same `youtube-nocookie.com` player the page already embeds, and Google accepts either. The watch URL goes in `sameAs` rather than `url`, so `url` stays the note's own address — consistent with every other shelf type, and with the `Review` wrapper that goes around rated entries.

## 42. A series is a relationship, not a place (2026-07-30)

`series: Road to Security+` in an entry's frontmatter puts a "Part 2 of 5" badge beside its date, which opens the list of every part. Two posts use it today; the machinery is in `lib/series.ts`.

**The list is a popover, not a panel.** It shipped as a card above the prev/next row first, and that was the wrong trade: five links the reader mostly doesn't need, permanently occupying the end of every part. Behind the badge the information is one tap away and costs no column. Construction is copied from the mobile contents sheet (#38) — always mounted and shown by `data-open` so it animates shut as well as open, `inert` when closed, an invisible backdrop for the click-outside, and contents that wait for the first open, which is what keeps it out of every part's static HTML. It's anchored to the badge at every width, because it should read as the badge opening — the first version relocated it to the bottom of the window below 640px, where it looked like something else arriving.

**Staying anchored on a phone costs nine lines of measurement.** The badge sits in a metadata row that wraps, so on a narrow screen it can end up anywhere across the column, and a panel hung off its left edge is one long title away from running off-screen. On open the component compares the anchor's left edge plus the panel's width against the window and sets a negative `left` if that overflows. It measures `offsetWidth` rather than `getBoundingClientRect().width`: the open transition is still scaling the element at that moment, and a transformed rect would report a width 3% short.

**A row is a number and a title.** Dates were in the first version and made every row wider for information the numbering already carries — this is a place to go, not a thing to read. There's no "Series:" label either: the badge that opened the panel has already said what this is, so the heading is just the series' own name.

**`components/Series.tsx` is a client component, so the data arrives pre-computed.** `getSeries()` builds the "Part 2 of 5" pair rather than leaving it to the component, which would mean importing from this module — and with it `lib/vault.ts`, and with it `fs` — into the browser bundle. Same server-slims-the-rows split as `PostList` → `PostListClient`, and the reason the `Series` type is imported `import type` rather than plainly.

**The header's metadata row became a `<div>`.** It was a `<p>`, and a `<nav>` isn't allowed inside one: a browser parsing the static HTML closes the paragraph early, producing a DOM that doesn't match what React rendered. Nothing about that row was ever a paragraph.

**No `/series/<name>` route.** The obvious next step is a page per series, and it's the wrong one: the list of parts already *is* that page, and it's on every part, where the reader actually is. A route would mean new slugs to keep stable (#27's argument about subfolders applies — a series is a relationship between notes, not a location), a sitemap entry and an OG image per series, and a second place the name has to be spelled correctly. If a series ever grows past the handful of parts a panel can hold, that's when it earns a page.

**The name is the identity — there is no id.** Matching normalises case and runs of whitespace and nothing else, so a genuine typo produces a second series rather than silently dropping a note from the first. That failure is visible in the rendered list ("Part 1 of 1" — which renders as nothing at all, see below), where a fuzzy match would quietly glue two unrelated arcs together. The name is also the panel's heading, so it's a string that has to be right anyway.

**Ordering is oldest-first, which is the opposite of every list on the site.** Sections sort newest-first because that's right for browsing; a series is read from the start. `part:` exists only for what dates can't express — two parts published the same day, or one written late and backdated — and notes carrying it sort ahead of notes that don't, so numbering half a series still puts those parts where you said.

**A single-part series renders nothing.** "Part 1 of 1" is a label with no navigation in it, and every series is a one-parter for however long it takes to write the second note. It appears the moment it means something.

**Drafts are not parts.** The index is built from `getEntries()`, which already drops drafts in production, so an unfinished part doesn't renumber the published ones — but it *is* numbered in `next dev`, where drafts are visible, which is the preview you want while writing it.

**Vault-wide rather than per section.** Wiki links already resolve across sections, and an arc that begins as a post and ends as a project is exactly what a series is for. The parts carry their own section in the href, so nothing assumes they share one.

**`series_uk:` is written once, on whichever part you were editing.** The lookup takes the first part that defines it. Repeating the name on all five parts is five chances for them to disagree, and the panel can only show one.

**The index is rebuilt per call**, like `getWikiIndex()` and unlike `getAssetIndex()`. The vault is sixty notes; a cache would buy nothing at build time and go stale on every save in `next dev`, which is where the frontmatter is actually being typed.

## 43. The audit pass: what every page was carrying (2026-07-30)

A look at the built output rather than the source, and most of what it turned up was weight.

### The search index stopped being a prop

`app/layout.tsx` called `getSearchIndex()` and passed it to the palette, and `getLinkPreviews()` and passed it to the hover cards. Both are client components, so both indexes went into the RSC payload of **every** page — the full plain text of the whole vault, in every document, twice (once rendered, once for hydration). `music.html`, a page with a few embeds on it, was **184 KB**. The Security+ post contained, verbatim, sentences from the propaganda post.

- **The index is now a file**: `app/search-index.json/route.ts`, `force-static`, fetched by `components/useSearchIndex.ts` the first time ⌘K opens and cached in a module-level variable. A reader who never searches never downloads it; one who does downloads it once for the whole session. It warms on pointer-enter over the search button, so the panel usually opens onto results.
- **Previews are filtered per page instead.** `previewsInHtml()` scans the page's *rendered* HTML — by then `[[wiki links]]` are real hrefs — and passes only the matching entries. A note linking to two others carries two, not sixty. A fetch would have worked here too, but hovering is latency-sensitive in a way that pressing ⌘K isn't.
- Result: first-certification **249 KB → 119 KB**, music **184 KB → 34 KB**, home **206 KB → 56 KB**. More to the point, the floor no longer rises with every note published.

### Two scaffolding notes were live

`Post Sample` and `Formatting playground` had no `draft: true`, so they were on the site, in the sitemap, in the RSS feed and in search. They're reference material for writing notes, not writing. Marked draft — still visible in `npm run dev`, gone from the build.

### Canonicals, and the `?lang=uk` problem they solve

There was no `<link rel="canonical">` anywhere, and `components/SelectionLink.tsx` hands out links carrying `?lang=uk`. To a crawler each of those was a separate copy of the note. `pageMeta()` in `lib/metadata.ts` now sets the canonical and `og:url` on every page, and `og:type=article` with `article:published_time` on notes.

**It re-declares things the layout already sets, on purpose.** Next merges metadata *shallowly*: a page that sets `alternates` replaces the layout's, dropping the RSS `<link>`; one that sets `openGraph` drops `og:site_name` and `og:locale`. Doing this by hand per page would have quietly removed them from exactly the pages that got the most attention.

### `lang="uk"` on the Ukrainian half

`<html lang="en">` never changes — it's the document's primary language and the canonical URL's, and the toggle is CSS, not routing. But the Ukrainian spans carried no language at all, so a screen reader announced Cyrillic with an English voice. One attribute in `components/T.tsx`, plus the `.uk` article bodies and the contents rail. The English span needs none: it inherits.

### Responsive images

`me.jpeg` is 208 KB and is painted as a 93px avatar. `mykhailo-fedorov.png` is 1.34 MB behind a grid card. `sync-assets.mjs` now writes 256/672/1344px WebP copies beside each raster and a ready-made `srcset` into the manifest; that avatar fetches 4 KB and the portrait 11 KB.

- **The originals are never touched.** They're the owner's files, and a browser choosing from a `srcset` never fetches `src` anyway — so the full-resolution copy stays available without anyone paying for it.
- **The widths mean something**: 256 is a small cover at 2×, 672 is the prose column exactly (`max-w-2xl`), 1344 is that column on a 2× display. Nothing on the site is ever painted wider.
- **Every `srcset` ships with a `sizes`.** Without one the browser assumes `100vw` and picks the largest candidate — worse than offering no choice at all. A sized embed knows its box (`93px`); everything else describes the column.
- WebP for the variants even when the source is PNG: it keeps transparency, and the original remains as the last candidate.

### The drawer is a dialog

The command palette had `role="dialog"`, `aria-modal` and focus handling; the sidebar had none of it — and, translated off-screen, its seven links were still in the tab order, so every page began with a tab through invisible navigation. It's now `inert` when closed, traps Tab while open, and returns focus to the menu button on close *unless* focus has already left with a navigation. A skip link sits first in the tab order.

### Tests can reach the whole of `lib/` now

`npm test` gained `scripts/test-resolve.mjs`, a loader hook teaching Node the `@/` alias and extensionless imports. Writing extensions into every import would have made the source worse in order to make testing possible. `lib/*.ts` also stopped mixing `@/lib/x` and `./x` for its own siblings — one convention, and the relative one is what the rest of the folder already used.

New coverage: the Now page's parser (which turns hand-written markdown into structured data by shape-matching, and fails silently) and the shelf's URL vocabulary plus `slugify` (which decides addresses that already exist in the wild). Writing the first one immediately corrected a claim in CLAUDE.md — `#current` sits at the end of the period line, not on a line of its own.

## 44. Motion that knows where it's going (2026-07-30)

Four movements, one API. `lib/view-transition.ts` holds the capability check and the rules; everything else calls it.

**Nothing intercepts anything unless it can do better.** Firefox has no `startViewTransition`, and `prefers-reduced-motion` opts out entirely (a transition can't be shortened to nothing — it either animates or it doesn't). In both cases the helper runs the update and returns, `<Link>` behaves exactly as it did, and the CSS-only `.page-in` fade stays in charge. **A missing animation must never become a missing navigation**, which is the whole reason the check lives in one place instead of at three call sites.

### Page transitions are hand-rolled, and that was the choice

Next has `experimental.viewTransition`, and it switches the app onto React's experimental channel to get it. For a repo whose stated goal is "simple, documented, low-maintenance", swapping the React build for an unreleased one to animate a page change is a bad trade. So `components/PageTransitions.tsx` intercepts the click itself.

- **The click is caught in the CAPTURE phase on `document`**, which runs before React's delegated handlers — so Next's `Link` never sees it and can't start a second navigation.
- **The transition is handed a promise that settles when the route has rendered**, which is what lets an asynchronous client navigation behave like a document swap. `usePathname()` changing is the signal. There's a 700ms timeout behind it: the API freezes the page until its callback settles, so a render that never lands must not be able to freeze the site. Pages are static and prefetched; it should never fire.
- **Direction comes from how you moved** — a link is forward, `popstate` is back — and lands on `<html data-nav>`, which picks the keyframes. On `popstate` the URL has already changed but React hasn't re-rendered, so the snapshot taken in that handler is still the old page, which is exactly what it needs.
- **The title travels.** A list row's title and the entry's `<h1>` are the same words, so they share `view-transition-name: entry-title` for the length of the animation and the browser tweens between them. Rows opt in with `data-vt-title`; the name is applied at click time and removed when the animation finishes, because **two rendered elements may never share a name** — leaving it set would break the next transition rather than this one, which is the kind of bug that gets found weeks later.

### The shelf fade is gone

#38 added a fade at whichever edge had more to scroll, to replace the scrollbar the rows hide. It was pretty and it was passive: it announced that there was more and offered nothing to do about it, while dimming the covers it was drawing attention to. Two controls replace it and both can be acted on.

- **Drag-to-scroll** on mouse pointers only. A trackpad already swipes a row sideways; a mouse has no way at all. Touch is left to the browser, since taking the pointer would trade momentum scrolling for something worse.
- **It becomes a drag only after ~6px of movement**, and the click that ends one is swallowed — the cover under the pointer at the end of a swipe is not the cover you meant to open.
- **That swallow needed a flag on `<html>`.** `PageTransitions` listens in the capture phase on `document`, which fires before any React handler, so it would have navigated before the row could cancel. `data-row-drag` is checked there and set here. Two features that never import each other still have to agree about one click.
- **Arrows** page by 80% of the visible width, appear on hover, and each hides at its own end. They're buttons, so a keyboard can reach the row — which the fade never allowed.

### The lightbox zooms

The clicked figure and the overlay's copy are the same picture, so they share a name and the browser grows one into the other.

- **`flushSync` around the state update**, or React would still be scheduling the render when the API takes its "after" snapshot and there would be nothing to animate to.
- **The name is moved, not copied.** The thumbnail is still on the page underneath the overlay; it releases the name inside the same callback that applies it to the overlay, and takes it back on the way out. Same uniqueness rule as the title morph, arrived at from the opposite direction.
- **Neither snapshot cross-fades** — showing two copies of one picture at two sizes while they travel looks like a double exposure. The group's growth carries the whole effect.

## 45. Reverting the navigation transitions, and what replaced the shelf arrows (2026-07-30)

**#44's page transitions are gone. They felt laggy, and the design says why.** The API holds the outgoing frame on screen until its callback settles, and on a client-side navigation that callback can only settle once React has rendered the new route. So every link click bought a freeze of however long the render took, in exchange for a 260ms slide — and a freeze before motion reads as lag no matter how short it is, because the page has stopped responding while looking identical.

The mechanism wasn't wrong; the trade was. `.page-in` fades on a key change and never waits for anything, which is why it never felt slow. Removed: `components/PageTransitions.tsx`, the `::view-transition-*(root)` rules, `html[data-nav]`, the `entry-title` shared element and the `data-vt-title` opt-in on list rows — and, with them, the `data-row-drag` flag the shelf needed only because a capture-phase click listener existed.

**`lib/view-transition.ts` stays, for the lightbox.** Nothing is awaited there: `flushSync` updates the DOM inside the callback, so the transition starts on the next frame. The API is a good fit for a same-document state change and a poor one for a route change, which is the actual lesson.

**The shelf arrows went too, one build after arriving.** #44 replaced the edge fade with drag plus hover arrows, on the reasoning that a control beats a hint. Half of that held: dragging is what people reach for, and it stays. The arrows were furniture — two floating buttons over the covers, for a gesture the row already supports, appearing on hover in a place the eye is already scanning. A row that hides its scrollbar and offers no edge treatment is quieter than either version, and the grab cursor carries the affordance.

That does leave the row without a static signal that it continues — the thing the fade existed for. It's a deliberate loss: the fade dimmed the covers it was pointing at, and the arrows cost more attention than they returned. If it needs solving again, the answer is a peeking half-cover at the edge rather than something drawn on top.

## 46. Recents, time remaining, and grain (2026-07-30)

**⌘K opens onto where you've been.** An empty query used to show the first eight pages of the index — the same eight for everyone, every time. `lib/recents.ts` keeps the last twelve paths in one localStorage key (same discipline as ReadingPosition: a bounded list under one key, never a key per page) and the palette leads with up to five of them under a "Recent" heading, with the rest of the site below under "Pages".

- **Paths are stored, not titles.** They're resolved against the search index at display time, so a renamed note shows its new name and a deleted one simply isn't found.
- **The current page is filtered out.** Offering to navigate to where you already are wastes the first row, which is the one under the cursor when the panel opens.
- **`>` scoped search skips recents entirely** — that mode asks "where in this page", and a list of other pages is an answer to a different question.

**Minutes left, bottom-right.** The header says how long the whole note takes; the pill says how much of it is in front of you, and it sits opposite the contents pill so the pair reads as a set: one says where you are, the other how much is left.

- **It's driven by the number the progress bar is already drawing**, so the two can never disagree. It's a prop on `ReadingProgress` rather than a component of its own for exactly that reason.
- **The DOM is touched only when the minute changes**, not on every frame of a 60fps ease.
- **It stays quiet below 6% and above 97%**: before that it would repeat the header's estimate, and after it "0 min left" arrives while the reader is still finishing a sentence. Rounded up, so a part-minute reads as a minute rather than as nothing.
- **It keeps the window's corner at every width**, unlike `.resume-reading`, which moves inboard under the contents rail from 1280px (#39). Two pills that can both be on screen shouldn't want the same spot.

**Grain.** One tile of `feTurbulence` fixed over the window at 2.8% opacity, 4.5% in dark mode. Large flat areas of a single colour are what make a monochrome page read as unstyled rather than deliberate; this gives the background a surface without introducing a colour, a border or a shape.

- **Generated by an inline SVG filter, not shipped as an image** — ~300 bytes of markup instead of a request, and it can't be the wrong resolution on a retina screen.
- **The tile is 160px**, which is not a round power of two on purpose: at 64px the repeat is a visible grid.
- **Fixed, not scrolling.** Grain that moves with the content is a texture on the content; grain that stays is a texture on the screen, which is the effect wanted.
- **z-index 1** — above the page, below the drawer, palette and lightbox. Those are surfaces of their own and should sit on top of it. `pointer-events: none`, and hidden in print, where paper has its own.

## 47. Why "Continue" never appeared on a phone (2026-07-30)

The offer withdrew itself when `scrollY` passed 400px — a statement about the page, not about the person. Every mobile browser restores its own scroll position on reload and on back, and that restoration fires `scroll` like anything else, so the pill was killed by the same event that made it worth showing. On a phone it effectively never appeared.

**Dismissal now keys on reader-generated input** — `wheel`, `touchmove` and the scroll keys — which is the distinction `components/Toc.tsx` already draws for its highlight (#38), and for exactly this reason: a scroll event says the page moved, not who moved it. Scroll restoration fires none of them.

**The decision also waits 250ms instead of one frame.** Browser restoration lands after the first frame, and on mobile several frames later, so the arrival check was reading a position that was about to change. Nothing is visible in that window — the pill's entrance animation is delayed longer than the wait.

**It is still rarer on a phone, and that part is correct.** The offer is only made when you arrive near the top; if the browser has already put you back where you were, there is nothing to offer. The feature exists for the case the browser doesn't handle — a fresh visit to a note you read days ago — and that is now reachable on mobile rather than being cancelled a frame after load.

## 48. A diagnostic you can read off a phone (2026-07-31)

"Continue" appeared on `localhost` and not on `kryloss.com`, on the same iPhone, on the same commit. That symptom has two completely different causes and they look identical from outside: the code is broken in the production build, or nothing was ever saved on that origin — localStorage is per-origin, so a position stored on `localhost:3000` does not exist on `kryloss.com`, and a first visit to a note can only save, never offer.

Settling it needs the four gate values at the moment the decision runs, and on iOS there is no console to read them in. So `?rp=debug` prints them on the page: the stored entry for this path, how many paths are stored at all, the viewport and page heights, the threshold, and PASS/FAIL for each of the four conditions. It renders whether or not the offer was made — the interesting case is the one where it wasn't.

**Opt-in, and therefore permanent.** It costs a normal visit nothing (no markup, one query-string read), and this is a feature whose whole job is to not appear, which makes "is it broken or is it working?" a question that will come up again. A temporary `console.log` would have answered it once.

## 49. "Arrived at the top" was the wrong question (2026-07-31)

The `?rp=debug` panel from #48 settled it in two readings. Nothing was broken: the position was being written correctly on production (`saved y=2018`), and the offer was refused because iOS Safari had restored the scroll to **exactly** 2018 — so the gate "arrived near the top" failed.

The conclusion was right and the reasoning was luck. What the rule was supposed to express is *don't offer to take the reader somewhere they already are*; what it actually tested is *did the page load at the top*. Those agree only when the browser restores to precisely the saved mark. A restoration that lands somewhere **else** — a note edited since, a window opened at a different width, images settling to a different height — was refused just as firmly, and that's the case where the offer is most useful.

**The gate is now the distance between where you landed and where the mark is**, and it has to be more than half a screen. Landing on the mark stays silent, landing anywhere else offers.

This is the second time this feature has been fixed by replacing a measurement of the page with a statement about the reader — #47 was the same shape (dismissing on `scrollY > 400` rather than on the reader actually scrolling). Worth remembering when the next condition gets written: **ask what the rule is for, then test that, not the thing that usually correlates with it.**

**And the pill is still supposed to stay quiet on a phone that restores you exactly where you were.** That's not a bug to chase; it means the browser did the job first. To see it fire on iOS, arrive at the note fresh — from a link, the palette, or a new tab — rather than by reloading the page you were already on.

## 50. One chip, two answers (2026-07-31)

On a phone the floating bar at the top-left now shows the breadcrumb when you arrive and the **time remaining** once you start reading down; the corner pill is hidden below 640px. On anything wider nothing changes — the breadcrumb stays put and the pill keeps the bottom-right corner.

The two labels answer the same question at different moments. "Kyrylo · Posts" matters when you land and stops mattering the second you start reading; "4 min left" is meaningless on arrival — it would just repeat the header's estimate — and becomes the only number you want halfway down. The bar already collapsed the breadcrumb on scroll-down (#—, the `compact` state), so the space was there and empty.

**The number crosses components as an event.** `ReadingProgress` computes it from the same progress value the bar is drawing; `Chrome` renders it. They're in different parts of the tree — one belongs to the article, the other to the site chrome — and a context provider wrapping everything for a single integer would be the wrong shape. `TIME_LEFT_EVENT` follows `langchange`, which the codebase already uses for exactly this kind of announcement.

- **Published only when the rounded minute changes**, not per frame; the easing runs at 60fps and React should hear from it about once a minute.
- **`null` is a real value** meaning "nothing to report" — too early, finished, or not a timed article — and it's published on unmount too, so the chrome doesn't keep showing the last article's number after you navigate away.
- **The swap is CSS, not conditional rendering.** `data-compact` on the bar animates `max-width` and opacity the same way the breadcrumb already collapses, so the two cross over rather than one popping in after the other disappears.

**And the label is always in the DOM, even with nothing to say.** Mounting it only once a number existed was the first version, and the chip visibly jumped: an element's first computed style *is* its final one, so it appeared mid-swap already at full width with nothing for the transition to run from. Empty it is a zero-width flex item, with a negative margin cancelling the flex gap so it leaves no notch.

Two smaller things were making the same movement feel loose. The breadcrumb and the label had **different durations and different easing** (220ms `ease` against 220ms `ease`, but applied to different properties at different moments) — they now share one duration and one curve, because they are one movement and a 40ms difference between them reads as a stutter rather than a resize. And the label's expanded `max-width` was 8rem against a real content width of about 4.5rem, so the reveal finished a third of the way through the travel and then sat still; 7rem lands it near the end.

## 51. The phone's top corners (2026-07-31)

The contents pill moves to the **top-right** on a phone and is only ever the three-line icon — no label, at any scroll position. The bottom of the screen is now empty, which is where the reading-position pill lives and where a thumb rests.

**It's sized from the bar opposite it, not from its own contents.** The floating bar at the top-left is a 2rem button inside 0.25rem of padding — 2.5rem tall — so this is built the same way: 0.25rem of padding around a 2rem icon square holding an 18px glyph, exactly the proportions of the menu button. Two chips in two corners have to agree on their height or they read as unrelated things that happen to be near each other.

**It briefly unfurled the current heading while scrolling down, and that was removed.** The idea was symmetry with the left bar, which swaps breadcrumb for time remaining (#50). In practice it meant a chip changing width in the corner of the eye, reporting something the reader hadn't asked for, while they were reading. The heading is one tap away inside the sheet. `html[data-scroll]` was added to drive it and has been removed with it — nothing reads it now.

**The sheet hangs directly under the icon.** It used to rise from a chip at the bottom-left, so both the anchor and the `transform-origin` inverted; a panel that grows from the wrong corner reads as a different element arriving rather than the one you pressed. On a phone it's also narrower (13.5rem), shorter (55vh) and tighter than on a laptop — it's an index, so it should cover a corner of the article rather than the article.

**Later (2026-08-10): one line per row is no longer a phone rule.** It was written here as a phone override, but the reason — an index that wraps stops reading as an index — was never about the width. It moved onto `.toc-link`, so the rail and both sizes of sheet truncate the same way and the full text is in every row's tooltip. `.toc-top` dropped its own copy of the same three declarations.

**The phone overrides have to sit AFTER the base rules in the file.** They were written before them the first time, and it looked like the media query simply wasn't matching: the sheet kept opening at the bottom-left, full desktop size. A media query adds no specificity, so `.toc-sheet` inside one and `.toc-sheet` outside one are exactly equal and the later declaration wins — which was the desktop one. Worth remembering in a hand-written stylesheet with no layers: **position is the tie-breaker, so an override belongs below what it overrides.**

**Nothing above 640px changes.** From 640 to 1279px the pill stays bottom-left with its label; from 1280px the rail takes over and the pill doesn't exist. The icon is `display: none` outside the phone range, so the "the label IS the control" design survives everywhere it was already working.

## 52. Override below, or not at all (2026-07-31)

The phone rules for the contents sheet were written *above* the base `.toc-sheet` block, and it read as the media query not matching: the sheet kept opening at the bottom-left, at full laptop size. It was matching and losing. **A media query adds no specificity**, so `.toc-sheet` inside one and `.toc-sheet` outside one are exactly equal, and the tie goes to whichever comes later — the desktop rule.

Moved below, where it can do its job. In a hand-written stylesheet with no `@layer`, position *is* the tie-breaker, so an override belongs under what it overrides. This had already caught the same file once; it is written here so the next one is cheaper to find.

## 53. The chip swaps vertically, and the lightbox arrows come off the picture (2026-07-31)

**The breadcrumb and the time now share one grid cell and pass each other vertically.**

The version before this animated both widths — the breadcrumb shrinking to nothing while the time grew from nothing — and the chip visibly bulged before settling. That's arithmetic, not a bug: two boxes resizing in opposite directions inside a shrink-to-fit parent produce a sum that peaks somewhere in the middle. **Stacking them removes the question**: the cell is as wide as the wider label, at rest and mid-swap alike, so the background never moves.

**Vertical, and that isn't only taste.** The swap is triggered *by scrolling*, and a label that travels the same way the page is travelling reads as part of that movement rather than as a separate animation that fired at you. The outgoing label leaves through the top, the incoming one arrives from the bottom, both clipped by a 1.25rem box.

Both labels are always in the DOM — an element mounted mid-swap has no previous style to animate from, which was its own jump (#50) — and above 640px the time is `display: none` rather than merely hidden, or it would still be sizing the shared cell.

**And the breadcrumb only moves when there is something to replace it.** For a moment the collapse was driven by scroll direction alone, which meant a section list or the home page animated its breadcrumb away on every scroll and left an empty chip — motion that spends the reader's attention and returns nothing. The swap now needs a number as well as a direction, so pages without a reading estimate simply keep their breadcrumb and never animate at all.

**On phones the lightbox arrows moved into the counter: "‹ 1 / 2 ›".** A 2.75rem circle floating over a full-bleed image covers the thing you opened the lightbox to see, and sits where the artwork is rather than where a thumb is. Below 640px the arrows join the counter in one row under the picture; from 640px they float at the backdrop's edges exactly as before.

The wrapper that makes this possible is `display: contents` on wide screens, so it collapses out of the box model entirely and the absolutely-positioned arrows keep resolving against the fixed overlay. One piece of markup, two layouts, and nothing conditional in the component.

## 54. One height for every shelf card (2026-07-31)

Cards were sized by **width** — `w-[150px]` for covers, `w-[280px]` for videos — and since a 2:3 cover and a 16:9 thumbnail turn width into height differently, the shelf came out as a 225px row above a 158px row above another 225px row. Each row was internally tidy, which is why it survived this long; it's the *page* that was ragged, and a section built entirely out of rows only reads as a shelf if the shelves line up.

**Height is now the constant** (`--shelf-card-h`, set on `.shelf-row`) and the widths are derived from it and the artwork's own aspect ratio. Height is the right one to fix because it's the dimension the eye measures while scrolling; width is what varies between media anyway, and letting it vary means nothing has to be cropped or letterboxed to fit. A video card is simply a wide card.

**Rows only.** On a medium page the cards sit in a grid where the column width leads and every card in the grid is the same shape already.

**Videos are the exception, and they get their own height rather than a crop.** A 16:9 card at the full shared height is 338px wide next to a 127px cover, so the video row read as the page's main event whatever happened to be in it. This was briefly solved by cropping thumbnails to 4:3, and that was the wrong lever: a YouTube thumbnail is composed at 16:9, and taking a fifth off each side to make a layout behave is the layout helping itself to the picture.

`--shelf-video-h` is two thirds of `--shelf-card-h`, which lands a video card at roughly 226 × 127 — about the presence of a cover turned on its side, uncropped. It's still *derived* from the shared height, so the shelf scales from one number and the two sizes can't drift apart.

**Which means the video row is shorter than the cover rows, and that's accepted.** The original problem was rows whose heights had no relationship to each other; two thirds is a relationship. Every row is still internally uniform, because a row is one medium.

**The height is between the two it replaced, not equal to either.** Covers used to make a 225px row and videos a 158px one. Taking 225 would have made a video card 400px wide — wider than a phone, and a cover row's worth of screen for one thumbnail. Taking 158 would have cut the covers to 105px, too small to read a spine at. 190 brings the covers down a little and the videos up a little, which is the version where nothing is dragged the whole way to the other. Below 480px everything steps to 170 together, which is the point of putting it in a variable.

**The widths are hand-written classes, not Tailwind arbitrary values** — but not for the reason first written here. An earlier version of this note claimed `w-[calc(var(--shelf-card-h)*16/9)]` is silently never emitted because `/` is Tailwind's modifier separator. That is false; it compiles, and so does `aspect-[4/3]`. The claim came from grepping the built CSS and finding nothing.

**What actually happened is worth more than the wrong lesson.** Tailwind escapes every bracket, paren and slash in the class name it writes, so the rule is on disk as `.w-\[calc\(var\(--shelf-card-h\)\*16\/9\)\]` — a plain grep for the source spelling matches nothing whether or not the rule exists, and "nothing" reads exactly like "never emitted". **Grep for the escaped form, or read the element's computed width in the browser.** A tool that cannot find something is not evidence that it isn't there.

The classes stayed anyway, on their own merits: the width is arithmetic on `--shelf-card-h`, the variable is declared in `globals.css`, and a rule that only makes sense beside its variable belongs beside it. `.shelf-card-tall` / `.shelf-card-wide` also name what they are, which a `calc()` inside a ternary does not.

## 55. A dip, so a tap has an answer (2026-07-31)

Every control on the site changed background on hover and did nothing at all on click. Hover is a statement about the pointer, not about the press, and on a phone it doesn't exist — so between tapping a post and the next page painting, the longest wait the interface asks for, the site showed nothing.

`.press` scales a control to 97% while it's held. Instant on the way down, eased on the way back up, which is what a physical button does and what makes the release read as the button pushing back rather than as a second animation.

**Opt-in, not `a:active`.** A scaled inline link inside a paragraph nudges the words around it and reads as a rendering fault. And several controls already own their transform — the lightbox arrows are centred with `translateY(-50%)`, the selection pill with `translateX(-50%)` — where a blanket `scale()` would *replace* the positioning and throw them off screen. Those two get composed rules.

**`--press-scale`, because the same percentage isn't the same movement.** 3% of a 32px chip is one pixel; 3% of a 320px card is ten. Cards take `.press-soft` and travel a third as far.

**The rule names the colour properties too.** Almost everything taking `.press` also carried Tailwind's `transition-colors`. `.press` is unlayered and the utilities are inside a layer, so an unlayered `transition: transform` wins outright and silently deletes the hover fade from the nav, the chips and the cards. Listing colour, background, border and the rest keeps both.

**And the block sits at the very end of `globals.css`,** because half the components it names declare their own `transition:` shorthand hundreds of lines above — and a shorthand resets every property it doesn't mention, transform included. Written higher up, the press would have been dropped from precisely the controls with the most polish. Third time this file has taught the same lesson (#51, #52).

## 56. The two places colour is allowed (2026-07-31)

The site is monochrome by rule. Two exceptions, both of which only exist under the pointer, so the page at a glance is unchanged.

**People photographs sit at `grayscale(0.3)` and come back to full colour on hover.** Not all the way to grey: a portrait at `grayscale(1)` next to monochrome type reads as an archive photograph, which says something about the person that isn't ours to say. At 0.3 the skin tones survive, the picture stops competing with a page that has no other colour in it, and the hover still has somewhere to go. A small contrast lift compensates for the flattening that pulling saturation always causes.

**Social icons take their platform's own colour on hover.** These five marks are already colours in everyone's memory, so this isn't decoration — it's recognition, and it's the one hover on the site that tells you something the grey version didn't. GitHub and X are brand-black, which is invisible on a near-black page, so both take a near-white in dark mode; that's the same mark at the lightness the medium allows, not an invented brand colour. **Instagram and LinkedIn get the actual mark on hover, not a tint of it.** A single colour is a fair stand-in for GitHub and X, whose logos really are one colour. It isn't for these two: Instagram's is a gradient, and LinkedIn's is white letters on blue.

- Instagram's glyph is drawn twice inside the same SVG — once in `currentColor`, once stroked with the brand gradient — and the two cross-fade. Not a `stroke` swap on one copy: `url(#…)` isn't an interpolatable value, so it would snap while its neighbours fade, and one icon behaving differently from the row is more noticeable than whatever colour it lands on. Its `--brand` deliberately holds still, or the grey copy drifts pink underneath the gradient and the middle of the fade goes muddy.
- LinkedIn's mark is one path with the "in" cut *out* of it, so the letters show whatever is behind the icon — the page. A white `.li-plate` rectangle sits under the path, transparent until hover, and fills those cut-outs. Then the path takes brand blue and the result is the logo rather than a tinted outline of it.

The gradient needs `gradientUnits="userSpaceOnUse"`. Without it the coordinates are read as fractions of the bounding box, so `x1="3"` means 300%, the glyph lands in a sliver of the ramp, and the whole thing renders as one flat pink — which looks like a plausible brand colour and is why it would have shipped unnoticed.

**Mail is the exception with no exception.** It stays `var(--text)`, because it isn't a platform — a red envelope would be inventing a brand for a `mailto:` link and quietly assigning it to Gmail, which is only where some of it goes. It still lifts from grey to full text colour on hover, so it behaves like its four neighbours without pretending to be one.

**On touch, the photographs are simply shown.** `@media (hover: none)` drops the filter entirely — without it the effect there isn't "grey until you ask", it's just grey.

**The sidebar's icon row is now `<SocialLinks />`.** It had been a second copy of the same markup at a smaller size, which is how the two rows came to have different hover behaviour in the first place; `socials` no longer needs threading through `Chrome` from the layout.

## 57. Shelf previews show the cover (2026-07-31)

A shared link to a book note used to render the same dark text card as everything else. But a shelf note is *about* a thing that already has a picture, and the picture is what someone recognises in a feed before they've read a word of the title.

`ogImage()` now takes an optional cover and splits the card: text left, artwork right, bled to the full height so it reads as a jacket rather than a thumbnail pasted onto a slide. The frame follows the medium — 2:3 for covers, 16:9 for videos — so nothing is cropped or letterboxed. The author gets a line, but only when there's art beside it; on the plain card it would sit where the section name already is.

**The image is inlined as a data URL, not linked.** These are generated *during* the build, when there is no server running to serve the site's own `/vault-assets/` files — a relative path renders as nothing, silently. Remote YouTube thumbnails are passed through, since Satori fetches those itself.

**Every failure path is a shrug.** Unknown format (Satori decodes no WebP or AVIF), missing file, unreadable — `ogCover()` returns undefined and the note falls back to the text card. A preview image that throws would fail the build of the page it belongs to, which is a steep price for a picture.

**Shelf only.** A post has no cover, and the photograph on a People note is a person's face, which is not a thing to paste into a link preview.

## 58. The global layer: one shell, and tokens instead of accumulation (2026-07-31)

Everything up to here was component-level. Looking at the site as a system turned up three things that weren't decisions at all — they were sediment.

**The page shell was written out seven times.** `mx-auto max-w-2xl px-6 py-14 lg:py-24`, copied into every route file, with two of the seven already quietly disagreeing (`py-20`, `py-24`). Nothing was wrong with any single copy. The problem is that "how wide is this site" and "how much air does a page open with" were not questions anyone could answer in one place — changing either meant a find-and-replace across `app/` that you could get partly right. `components/Page.tsx` now owns it, backed by `--measure`, `--gutter` and `--page-y`. Extra props pass through, which is how the entry page keeps hanging its `data-vault-source` attributes there.

**Ten corner radii.** `0.1875rem`, `0.375rem`, `4px`, `0.5rem`, `0.625rem`, `0.75rem`, `1rem`, `999px`, `9999px`, plus five Tailwind classes. Nobody chose that set; it arrived one component at a time. Four tokens now, deliberately equal to Tailwind's own scale so the utility classes and the hand-written rules in `globals.css` can't drift apart again. This is invisible on any one element and quite visible across a page — it is most of why a screen can feel unresolved without anything being identifiably wrong.

**A motion language spoken a third of the time.** The signature curve appeared 15 times against 39 uses of the browser default `ease`, across eleven durations: 60, 90, 120, 150, 160, 180, 200, 260, 320, 400 and 600ms. Now one `--ease` and three steps — `--dur-fast` for colour changes, `--dur` for most movement, `--dur-slow` for things that travel. Tailwind's `--default-transition-timing-function` and `--default-transition-duration` point at the same tokens, so the utility half of the site moves like the hand-written half rather than merely near it.

**And `--bg-hover` was doing two jobs.** It was the response to a pointer *and* the fill of a card, a cover box and a badge — which meant the two could never be tuned apart: any attempt to lift cards off the page in dark mode would have lifted every hover state with them. `--surface` splits the name. The values are identical today on purpose; the point is that they no longer have to be.

**None of this changes a design decision, and that's the test it had to pass.** Radii moved by a pixel or two where they were consolidated and a few durations changed by tens of milliseconds, but nothing was re-styled. What changed is that the site's design is now editable from one place, which it wasn't — and the things that come next (a type scale, a persistent rail on wide screens) are decisions rather than sweeps because of it.

## 59. Two themes, temporarily, so the design can be judged rather than remembered (2026-07-31)

Eight notes on the site's visual design are all implemented at once, as **theme one**, with the design that existed before them kept whole as **theme two**. `Cmd+K → "Switch design theme"` flips between them. There is no control in the interface, deliberately: this is a tool for the owner during a decision, not a preference for readers.

**Theme one is the ABSENCE of the attribute**, not `data-theme="one"`. Only `"two"` is ever written to `<html>`, and the new design is scoped `:root:not([data-theme="two"])`. So the default arrives with no script involved — a first visit, a visitor with JavaScript off, and the static HTML before the inline restore all get theme one, and there is no flash to prevent. The mechanism is otherwise the language toggle exactly: one localStorage key, restored pre-paint in `app/layout.tsx`.

**What theme one changes, and why each one is on the list:**

1. **A wider tonal range.** Three text greys all living in the middle, with borders a shade off the lightest. Monochrome design has nothing *but* the distance between its darkest and lightest marks, and that distance was compressed. Headings go properly black, tertiary text properly light, borders retreat.
2. **One big thing per page.** Every page opened at the same volume — a 20px heading over 16px body over small chips — so nothing was ever the moment. `.page-title` is now `clamp(2rem, 1.3rem + 2.6vw, 2.875rem)`, two to three times what surrounds it, and it scales with the window instead of sitting at one size from a phone to a 27-inch display.
3. **Image shapes — tried and reverted.** Faces briefly took the covers' 2:3 portrait frame, on the theory that one silhouette for everything with artwork would read as a system. A person is not a book jacket: a square crops to the face, where a tall frame either includes a lot of room the photo wasn't composed for or turns it into a passport photo. Squares stay, and the five silhouettes stay five. The `.people-cover` hook is kept for whenever this is looked at again.
4. **The accent gets exactly one job.** `--accent` was reserved for "the odd functional case" and surfaced in two: the OG card bar and the 404 link. A reader's only exposure to the site's accent colour was an error page. It now belongs to the reading progress bar — the one element genuinely reporting *state* rather than decorating something — and nothing else.
5. **Dark mode stops being light mode inverted.** Borders are dimmer relative to text than they are on white, and `--surface` sits *above* `--bg` rather than beside it. That's what splitting the token off `--bg-hover` in #58 was for; this is the first use of it.
6. **One voice, everywhere except code.** Source Serif 4 is the site's typeface in theme one, not just the article's: sidebar, section headings, list rows, chips, dates, buttons, and the labels inside diagrams.

   This began as the classic split — serif to read, sans for the interface — and the split was wrong for a site this size. A personal site is not an application with articles in it, and when half the page is chrome in a different family, the chrome reads as a product someone else built and the writing reads as content pasted into it. Set on `body` so everything simply inherits; `<code>`/`<pre>` keep their own family from Tailwind's preflight, restated explicitly so it isn't an accident of load order.

   **Diagrams come along without touching the vault.** The generated SVGs carry `font-family="ui-sans-serif, …"` as a *presentation attribute*, which loses to any CSS rule targeting the element — so `svg.diagram text` restyles them from `globals.css`. Vault files are content and the owner's; a stylesheet reaching into them would have been the wrong fix. Only self-theming SVGs are covered, since those are inlined into the page; a two-file Excalidraw export is an `<img>` and can't be restyled from outside.

   The `body` tracking of -0.02em is reset to normal: it exists because Inter sets loose default spacing at body sizes, and the same value cramps a serif — the Cyrillic especially.
7. **Metadata that stops competing.** Date, reading time, word count, maturity and the series badge sat under the title at sizes close enough to argue with it. One size, one grey, one line. The `categories:` chips were bordered pills at body size — three of them were as loud as the heading — and are now `#tags`.
8. **Spacing that groups.** A heading two lines below the paragraph it interrupts belongs to that paragraph. The space above `h2` is now well past the space below it, and pages open with more air, so sections separate without a single divider.

**Newsreader was chosen and then rejected: it has no Cyrillic subset.** It is the better screen serif, and every note on this site carries a Ukrainian translation — a typeface that covers half the content isn't a candidate, it's a bug with good kerning. Source Serif 4 has Cyrillic *and* Cyrillic-Extended, is variable, and was drawn for text at reading sizes. **Worth remembering as a rule: on this site, script coverage is a hard filter, applied before anything is judged on looks.**

**This is scaffolding and should not survive the decision.** Whichever design wins should be the only one in `globals.css`. Delete the loser, `lib/theme.ts`, the palette action, the `actionToggleTheme` string and the theme half of the inline script.

### Outcome (same day)

**Theme one won and the switch is gone.** `lib/theme.ts`, the palette action, its `ui` string, the `[data-theme]` half of the inline script and every `:root:not([data-theme="two"])` selector have been deleted; the tokens are folded into `:root` and the rules into the ordinary stylesheet, under a "Visual design" banner at the foot of `globals.css`. The eight points above are now just how the site looks, and this entry stands as the reasoning behind each of them.

**Carried over whole, including the darker background** (`--bg: #08080a`, `--bg-sidebar: #0c0c0e`). It was briefly reverted to the old `#0a0a0a` on a misreading of a bug report — see #60, where the actual problem turned out to be the floating chrome rather than the page behind it. The page is darker than it was and that is the intended design; the pills stopped being invisible because they were given a surface of their own, not because the background was lightened.

**Inter is now loaded and unused.** It's still in `app/layout.tsx` and still owns Tailwind's `--font-sans`, but with the serif set on `body` and code carrying its own monospace stack, nothing on the site renders in it. Dropping it would save a download; keeping it costs a font file and leaves the door open. Left in deliberately, and noted here so it isn't discovered as a mystery.

## 60. The floating chrome was the page's own colour (2026-07-31)

Reported from a phone: after the design pass the site read as *completely black*, with the breadcrumb bar and the contents pill barely visible. On a desktop nothing had changed.

The desktop/phone split was the tell, and it isn't about screen size — it's about **which mode each device was in**. The regression was entirely in dark mode, and the phone was the only device looking at it.

**The bars were built out of the page they float over.** `.chrome-bar`, `.toc-bar`, `.time-left` and `.resume-reading` were all `color-mix(in srgb, var(--bg) 75%, transparent)` with a blur and **no border** — the page's own colour, painted at 75% on top of the page. In light mode that works by accident: the backdrop blur smears the text behind the pill and the smear is what your eye reads as an edge. In dark mode there is nothing to smear into anything, so a near-black pill sits on a near-black page and the only thing marking it is its content.

Making `--bg` darker (#0a0a0a → #08080a) didn't create this, it just removed the last of the margin. **A surface defined as a fraction of the thing behind it can't be seen against the thing behind it** — the transparency was doing all the work and there was no fallback when it stopped being enough.

**The background was reverted first, and that was the wrong fix.** "The site went black" reads as a statement about `--bg`, so `--bg` is what got changed; the pills were still the page's own colour afterwards, just a slightly lighter shade of it. The report named a symptom and the symptom named the wrong element. `--bg` is back at `#08080a` where the design put it. **Worth remembering: when something is invisible, ask what it's drawn FROM before changing what it's drawn ON.**

**They now take a surface that sits above the page.** `--chrome-bg` is built from `--bg` in light mode (unchanged) and from `--surface` in dark, which is lighter than the background — the token split off in #58 for exactly this, used properly for the first time. Plus a hairline.

**The hairline is an inset shadow, not a border.** `.toc-bar` and the breadcrumb bar are deliberately built to the same 2.5rem height (#51); a real border adds two pixels to whichever of them got it, and the two chips in opposite corners would stop agreeing. `box-shadow: inset 0 0 0 1px` costs no layout at all.

**And the breadcrumb bar's fill was a Tailwind utility on the element** (`bg-[var(--bg)]/75`), which is why it was the last piece of chrome still painted in the page colour after the others were fixed — it wasn't in the stylesheet to find. It's `.chrome-bar` in `globals.css` now, sharing the token with the pill opposite it. Two chips that are the same object at two corners should not be styled in two different files.

**Two dark-mode values came back up as well.** `--border` (#1d1d21 → #26262b) and `--text-tertiary` (#5e5e68 → #6f6f7a). Widening the tonal range is right on white, where pushing the quietest grey lighter costs nothing; in dark mode the same move pushes it *toward the background*, and on a phone in daylight it disappears. **The rule isn't "more range", it's "more distance from the background" — and which direction that is depends on the mode.**

## 61. Consequences of the serif (2026-08-01)

Eight changes, all of them problems the redesign itself created or exposed.

**Three typefaces, one voice.** Inter was still loaded and rendered nowhere — the serif on `body` had left it nothing to set. Lora was carrying quotations on the strength of being *a serif against Inter*, a distinction that stopped existing the moment the site became a serif; against Source Serif it doesn't read as a second voice, it reads as a font that failed to load. Both deleted. Source Serif's own italic is the quotes voice now — same family, different cut, which is the older and better way to do it. Three webfont families to one.

**The optical size axis was being paid for and not used.** Source Serif 4 draws its letterforms differently at 8pt than at 60pt — finer hairlines and a tighter fit as the size goes up. `next/font` ships only a typeface's default axis unless the others are named, so `axes: ["opsz"]` was needed before `font-optical-sizing: auto` could mean anything. Verified in the built files: `wght 200–900` and `opsz 8–60`. Without it a 46px title is body type scaled up, which is exactly what a display size shouldn't be.

**`.prose h1` was sized for a title that no longer exists.** 20px, chosen when the entry title was 24px and the two sat close. Against a 46px `.page-title` a markdown `#` read as a mistake rather than a level. Now 28px, with h2 and h3 stepped up behind it — the old 20/18/16 over a 17px body was not a scale, it was four sizes of nearly the same thing.

**`text-wrap: balance` stopped being polish.** A word alone on the last line is a blemish at 18px and a real flaw at 46px. `balance` on headings, `pretty` on body copy — `pretty` only forbids the orphan rather than re-flowing the paragraph, which is why they get different values.

**The measure was set for the old typeface.** 42rem was chosen for 16px Inter; at 17px Source Serif it's roughly 78 characters a line and a serif wants 60–70. Now 39rem. **A typeface change is a measure change** — the token that should have moved with it and didn't.

**The accent got its job back, and then some.** #59 cut `--accent` down to the reading progress bar alone, on the argument that one use is better than three scattered ones. That was half right: the principle was good and the scope was too tight — it left prose links distinguishable from body text by an underline alone, and made a progress indicator the only colour a reader ever met. The rule now is **the accent marks what you can act on and what reports state**: links, focus rings, the `[progress::]` bars, the reading bar. Navigation and chips stay monochrome with their text-on-background inversion, because colouring those too would turn the chrome blue and leave the accent meaning nothing again. Callouts keep their four hues.

**Selection is tinted rather than inverted.** A solid black slab hid the serif's shapes; a wash keeps the text readable while it's selected, which matters here because selecting prose is how the copy-link pill is summoned.

**Two things removed rather than restyled.** The "← Section" link sat directly above a very large title while the floating breadcrumb already named the section and linked to it — deleting it lets the title be the first thing on the page, which is the entire point of making it big. And shelf and people cards carried a border *and* a surface fill, two ways of saying "this is an object"; the fill says it, so the hairline is gone.

## 62. A standing pages rail, from 1280px — BUILT AND REMOVED (2026-08-01)

On a wide screen the site was a 39rem column with a contents rail on its right and nothing at all on its left, and every route to another section went through a drawer you had to open first. `.side-rail` fills that margin: the sections as plain text, with the search field above them.

**Always visible, not another thing to open.** The drawer already exists for that. A panel you have to summon in order to see a seven-item list is a worse version of a list.

**1280px, because that is where `.toc-rail` appears.** Arriving earlier would put weight on the left of the page with nothing to answer it on the right — the layout would read as lopsided rather than as a spread. Below 1280 nothing changes.

**The same KIND of object as `.toc-rail`, and quieter than it.** It was first built like the phone's contents *sheet* — card, blur, shadow — and that was the wrong reference. A sheet is summoned, glanced at and dismissed, so it announces itself; a rail is present the entire time you read, so it must not. A permanent card in the margin competes with the article for the whole visit.

The second pass copied the contents rail exactly — hairline, 13rem, rows right-aligned against the rule — and that was still too much. **The contents rail is about the thing you're reading; this isn't**, so it has less claim on attention, not an equal one. It also borrowed a width it didn't need: 13rem is sized for sentences, and this holds single words. Now 9rem, left-aligned, no rule at all — seven short words in the faintest grey, indented to sit under the bar above so it reads as hanging off the chrome. Findable when looked for, invisible when not.

**Plain text, no icons, and search is the glyph alone.** The drawer keeps its icon column; at this size a row of emoji beside seven words is noise. Search was briefly a labelled field with a `⌘K` hint, which made it the loudest thing in a column whose whole purpose is to stay quiet — a drawn box in a panel that has no other boxes in it. The magnifier says the same thing, and the shortcut lives in the button's title and in the `?` cheat sheet.

**No state, so a media query is the whole implementation.** The rail renders at every width and CSS hides it below 1280 — no resize listener, nothing to measure, and nothing that can disagree between the static HTML and the first client render.

**The one thing that does have to wait for the browser is the key hint.** `⌘` or `Ctrl` depends on `navigator`, which the server doesn't have, so it renders as `⌘` and is corrected in an effect. A Windows visitor sees the Mac key for one frame; that is a better trade than a hydration mismatch, and the shortcut itself has always accepted either.

**Active state is weight and full text colour** — with no rule to mark, that carries it alone, and it adds no ink to the page when you aren't looking for it. Monochrome on purpose: the accent marks links and state, not navigation (#61).

### Outcome: deleted the same day

Three passes — a floating card, then a copy of the contents rail, then a bare 9rem list with no rule — each one quieter than the last, and the honest read at the end was that the thing itself was the problem, not its styling.

**The premise was wrong.** The rail existed because a wide screen has empty margins, which is a statement about the window, not about the reader. Nothing was being asked for: this site has seven sections, the drawer is one keystroke or one click away, `g 1…9` jumps to any of them, and Cmd+K searches everything. A permanent list of seven words was answering a question nobody had, and every attempt to make it less intrusive was really an attempt to make it less present — which is what "delete it" means.

**Empty space is not a defect to be filled.** A wide margin around a 39rem column is what makes the column readable. The successive rounds of quieting were the design arguing itself toward zero, and it should have been read that way sooner.

`.side-rail`, its markup in `Chrome.tsx`, the `metaKey` platform detection and the `searchShort` string are all gone. The entry is kept because the reasoning about *sheet versus rail* (a summoned panel announces itself, a permanent one must not) is worth having, and because the next idea that starts with "there's space over there" should meet this one first.

## 63. The accent is green, and it marks UI rather than sentences (2026-08-01)

Two corrections to #61, which had just widened `--accent` from one job to several and put it on prose links.

**Prose links are text colour again.** Colouring them was the obvious move and the wrong one: a link every other sentence turns a paragraph into a page of coloured words, and the eye stops reading and starts scanning. The underline already says "link" — the oldest and quietest convention there is, and it costs the sentence nothing. **A control made of words inside a sentence is still part of the sentence.**

**The accent goes to UI instead:** the filled state chips, the contents marker, the `[progress::]` and reading bars, focus rings, the selection wash, the done checkbox on the Now page. Those are all things that report state, and none of them is prose. Standalone ACTION links keep it — "Continue reading", "Back home" — because those are controls that happen to be made of words rather than words that happen to link.

So #61's principle survives ("what you can act on, and what reports state") and its scope was wrong twice in opposite directions: #59 cut it to a single bar, #61 spread it into body copy. The line is prose.

**The hue is the tip callout's green.** It's the one colour already on the site that meant *this is fine, carry on* rather than *look here*, which is what a state marker should say. It also stops the accent being the fifth unrelated colour on a page that already had four in its callouts.

**Light and dark carry different values of it, for contrast rather than taste.** `#10b981` works as a 3px callout border, which asks nothing of a contrast ratio. As a link colour on white it lands near 2:1, and as a chip fill it can't carry white text. `#047857` on white and `#10b981` on near-black both clear 4.5:1 in every direction the token is used — as text, as a fill behind `--bg`, and as a focus ring.

**The OG card's rule changed with it**, since that colour is baked into the image at build time and would otherwise be the last blue left on the site.

## 64. No accent, and no emoji outside the sidebar (2026-08-01)

**The accent token is deleted.** Its history: blue for "the odd functional case", cut to the reading bar alone (#59), spread onto prose links and UI (#61), changed to the tip callout's green and pulled back off prose (#63). Four passes hunting for the right amount of one colour — which is the shape of an answer that is zero.

Everything it was carrying now uses `--text`: the filled state chips, the contents marker, the `[progress::]` and reading bars, focus rings, the selection wash, "Continue reading", "Back home". None of it lost anything, and that is the point — **on a page with no other colour, full text colour IS the emphasis.** A monochrome design doesn't need an accent; it needs a range, and it has one (#59).

Two things kept their colour deliberately. **Callouts** keep four hues, because there the colour carries a meaning nothing else on the page carries — note, tip, warning, danger are four different things, not four decorations. And the **hover-only exceptions** stay: people photographs return to full colour, social icons take their platform's (#56). Both are colour that arrives when asked for and is absent otherwise.

The OG card's rule went white with everything else — that colour is baked into an image at build time and would have been the last of it anywhere on the site.

**Emoji are sidebar-only.** They were also on the home page's Explore cards, in each section page's title, and as the seedling/tree glyph in a note's metadata. In the sidebar an icon is doing work: it's a target you aim at in a list you've learned the shape of, and it survives being read at a glance. On a page it's decoration next to a heading that already says the word — and next to a serif at 46px, a colour emoji is the one thing on the screen not drawn by the typeface.

`resolveIcon()` is unchanged and the `icon:` frontmatter still means what it did. The nav items still carry it. It just isn't rendered outside the drawer.

## 65. A series that knows what you've read, `j`/`k`, a terminal, and one idea that didn't survive the day (2026-08-01)

### The reading bar shows structure — BUILT AND REMOVED (same day)

One hairline notch per `h2`, hanging under the bar and brightening as the bar passed it. The reasoning was sound — a percentage answers *how far*, and nobody asks that on its own; they ask *how much more of this*, and "three sections left" is the better answer.

It looked like dirt on the line. A 2px hairline is not a surface you can put marks on: at that size a notch is either invisible or a speck, and there is no third size. **The bar is a line, and a line can carry a position but not a structure** — that job already belongs to the contents rail, which has room to name the sections rather than count them.

Deleted: `chapterTicks()` and its tests, the `.reading-tick` rule, the heading pass in `measure()`. Kept here because the *positioning* insight is worth not re-deriving: a heading's place on the BAR is not its place on the page, since media is discounted (#36) and anything past a "Sources" heading isn't counted, so anything ever drawn against the bar has to be converted through `progressAt()` first.

### The bar is what knows you finished

`lib/read-notes.ts` is a second, much smaller store: path → when you finished it. Deliberately NOT the same question as `ReadingPosition` (#47–#49), which remembers *where you stopped* — that store holds a scroll offset and nothing about the page's length, so `y = 4300` is a finished short note and an abandoned long one at the same time. The reading bar already computes the answer properly, so the bar is what writes it, at 92%.

**A note shorter than the viewport is read by being opened.** `finishAt()` returns 0 for one — a bar for a note you can see all of would be a lie in either direction — so there is no progress to cross a threshold, and short notes were silently never recorded. There is also nothing left to measure: the whole note is in front of the reader on arrival. A dwell timer was tried first and is the wrong shape of answer — it invents a threshold ("eight seconds") for a page that has no second event to wait for. Opening it is the only event there is, so opening it is the signal.

**And the tick is a checkbox.** Everything above is a good guess and no more than that: someone who skimmed to the bottom for one line has "finished" by the bar's reckoning and knows they haven't, and a part read on another device was never seen by this browser at all. So it can be pressed, either way. The measurement is the DEFAULT, not the verdict — which is the same principle as `ReadingPosition` never scrolling on its own (#47): the feature may offer a conclusion, it may not impose one.

The badge reads the store: a solid line grows along its dotted underline as you finish parts, and the panel counts them. **The badge never changes size** — "· 3 read" in the metadata row would reflow the date and reading time beside it every time the number went up, so the progress is drawn, not spelled. All of it starts at zero and fills in after hydration, because the server has no idea who is reading; a `noteread` event means the badge fills in under you as you finish the part you're on, without a navigation.

### `j` / `k` walk the list, and the highlight is real focus

The rows are found through `.stagger` — not a new hook, but the class every list on the site already carries so its children can arrive one at a time (#38), which makes it the existing answer to "which elements here are a list". Hidden-language lists are skipped by `offsetParent`, the same test the reading bar uses.

**The highlight is focus itself**, not a selected index painted to look like focus. That gets Enter, Tab continuing from where you are, and a screen reader being told what you're pointing at, all for free. The `.list-focus` class exists only because a programmatic `.focus()` isn't reliably `:focus-visible` across browsers.

**It paints the hover wash, not a ring.** A row under the pointer and a row under the keyboard are the same state — *this is the one you'd open* — and giving them two appearances says they aren't. The focus ring is suppressed on those rows for the same reason: with the wash there, the ring is a second answer to a question already answered.

Two things it deliberately doesn't do: it never fires while a modal is up (read from the DOM as "a dialog that isn't `inert`" — this component doesn't own the drawer or the palette and shouldn't be handed their state), and it doesn't swallow the key on a page with no list, where someone's Vim-style scrolling extension has a better claim to it.

### A shell fence is a window, not a file

Most of what gets pasted into these notes is a session — an nmap run, a `systemctl status`, a failed login — and a session is a window you were sitting at, not a file you wrote. ```bash and friends now get a title bar with three dots instead of a filename tab, and get one whether or not a title was given: the dots ARE the header, and a terminal without its title bar is just a grey box.

**The dots are grey.** Red/amber/green would be the only colour on an otherwise monochrome page, and the shape already says "terminal" without them — this is the same line #64 drew around the callouts, from the other side.

### Three more, while in there

**The section is the only ancestor there is.** `/shelf/type/books` read "Shelf · Kyrylo" and `/shelf/type/books/fantasy` read "Books · Shelf · Kyrylo", so pressing a category chip changed the shape of the trail — which reads as having navigated somewhere when you haven't. Both now read "Shelf · Kyrylo".

The first attempt went the other way, adding "Books" to the medium page so the two matched. That fixed the inconsistency and broke the rule: a medium page's `<h1>` IS "Books", so the crumb was saying the page's own name back to it — the exact thing the breadcrumb was changed to stop doing. When two pages disagree, the one to change is the one breaking the rule. `NavItem.mediums` existed only to feed that crumb and is gone with it, along with the `shelfGroups()` pass the layout ran on every build to fill it.

**The copy button is centred against the code header**, not pinned 0.5rem from the top of the figure. That offset was right against bare code and a third of a rem low against a title bar — invisible until shell blocks started always having one. The header's line-height is now stated rather than inherited, so the height it's centred against is a number this file knows rather than one that depends on a `.prose` rule several hundred lines away.

**The selection pill says "Selection".** It appears attached to the text you just highlighted; "Copy link to selection" spent three words restating what is already on screen.

## 66. Motion that answers, in four places (2026-08-01)

The site had entrances (#38, #44) and a pressed state (#55) — motion for *arriving* and for *being touched*. What it had none of was motion that answers what a control MEANS. Four additions, each attached to a specific meaning rather than to a specific element.

### An arrow goes where it points

The one glyph on the page that means a direction, and the only thing here that never moved in one. It leads by 3px on hover and, on press, keeps going and fades — so the last thing you see before the next page paints is the arrow leaving the way you sent it. This fills the same window `.press` was built for: the gap between a tap and a new page is the longest wait this interface asks for.

**It has to outlive the press, and CSS can't do that.** `:active` ends the instant the finger lifts — a fraction of a second BEFORE the next page paints — so the first version raced the arrow back to its resting position and then changed the page. The gesture read as cancelled rather than sent. There is no state after `:active` to hold and an animation with `forwards` is dropped along with the selector that started it, so `components/ArrowThrow.tsx` adds one class at the click and never takes it off: the navigation unmounts the link, and the arrow's last frame is the one on screen while the new page arrives. A 1.5s timer is the only cleanup, for a click that doesn't navigate.

**And it needed to be slower.** At `--dur-fast` the throw was a jump. It runs at `--dur-slow` now — this is the one piece of motion on the site anyone is meant to WATCH, where everything else is a response you feel rather than see.

**The keyboard gets it too.** `[` and `]` navigate through those exact links, so `Shortcuts` adds the same class before pushing the route. A shortcut that skipped the animation would make the mouse and the keyboard feel like different sites.

**The lightbox arrows throw shorter and don't fade.** They step through a gallery you stay in; an arrow that flew off the screen would promise a page change that isn't coming. Same gesture, different sentence.

`ui.continueReading`, `ui.allPosts` and `ui.backHome` all lost their arrows, which are now `.arrow-glyph` spans. An arrow baked into a translated string can't move, and is one more thing a translator can drop. `.is-back` is the leading kind ("← Back home"): before the words, thrown the other way, because it points back where you came from.

### A tick that draws itself

`stroke-dasharray` set just over the path's length makes the whole stroke one dash; walking the offset to zero draws it. Both check paths were rewritten to start at the short arm (`M4 12l5 5L20 6`) — a dasharray follows the path's own direction, and a tick that draws backwards reads as an error being undone.

The copy button uses an **animation** and the series checkbox a **transition**, and the difference is not stylistic: the copy icon goes from `display: none` to visible, and a transition has no previous computed value to move from on the frame an element first renders. The checkbox is always in the DOM, so a transition gets un-ticking for free.

### The underline sweeps

A link in a sentence rests on a grey rule and takes a black one from the left. On a page with no accent (#64) the underline is the link's only voice, so it needed a way to answer beyond changing colour all at once.

**Two gradients, not `text-decoration`** — a decoration can only change colour; there is no way to grow one from one end. The cost is `text-decoration-skip-ink`, which a background can't do, so this is scoped to links in actual prose (`p`, `li`, `blockquote`, `td`) and the rule sits at the bottom of the text box, clear of the descenders it would otherwise cut. Heading anchors, footnote references, embed fallbacks and image links keep the plain decoration. Under `prefers-reduced-motion` both layers are drawn full-width and the colour swap comes back — the link still answers, it just doesn't sweep.

### The palette highlight slides

One wash moving between rows instead of one switching off and another on — the same object as the contents rail's marker (#38) and the same argument: **moving between two states says they are the same thing at two moments; two separate paints say nothing at all.**

Measured from the live DOM rather than computed, because rows differ in height and group labels ("Recent", "Actions") appear between them depending on the query. Any arithmetic for "where is row 4" would be a second, quietly wrong copy of the list's own layout.

**No entrance stagger on the results.** It was in the original sketch and it's wrong: the list re-renders on every keystroke, so a staggered entrance would replay under the reader's fingers while they type. An entrance animation belongs to something that arrives once.

### One metadata line, joined rather than punctuated

The entry header had two rows under the title: date · reading time · words · maturity · series, and then the `categories:` chips on a line of their own. Two rows of metadata under a title is one more than the title deserves, and the tags are the same kind of thing as everything beside them — something the note knows about itself. They moved to the end of the one line.

The separators were also wrong, and wrong in a way that shows why. They were written as `{a && b && <span>·</span>}` between each pair, which means every pair that can ever be adjacent has to be named — and one wasn't, so the maturity ran straight into the word count as "37 wordsSeedling". The pieces are now collected into an array and joined, which cannot have that bug: a list doesn't care what's on either side of a gap.

The tags take ONE middot in front of the whole set rather than one apiece — the hashes already separate them from each other.

One more of the same kind: the middot between the reading time and the word count was typed inside their shared span, surrounded by ordinary spaces, while every other separator on the line is spaced by the row's `gap`. It looked like a separator and wasn't one, so those two sat visibly closer together than anything else. They're two entries in the list now.


## 67. The breadcrumb reads outside-in (2026-08-01)

The order was most-specific-first: "Music · Kyrylo", "Posts · Kyrylo". It read backwards — a trail is walked from the root inward, and the site name is the root. It now reads "Kyrylo · Music", "Kyrylo · Posts", and the crumb given full colour (`--text` rather than `--text-secondary`) moved from the first position to the last, since that's still the one closest to the page you're on.

## 68. "Кирило" in the breadcrumb, and home stays grey (2026-08-01)

Two follow-ons to #67 (the breadcrumb reading outside-in).

**The site name had no Ukrainian form.** `siteName` ("Kyrylo") feeds machine fields — RSS, OG images, JSON-LD — that stay in Latin regardless of the reader's language, so the constant itself wasn't touched. A sibling `siteNameUk` ("Кирило") was added and threaded through `Chrome` as its own prop, the same way `siteName` already was — used by the breadcrumb crumb AND the sidebar wordmark, the two places the name is read as prose rather than as data.

**Home stayed white when the emphasis rule flipped.** #67 moved the full-colour crumb to whichever one is closest to the current page — last, now that the site name leads. On every other page that's correct: the section is where you are. On home there's only one crumb, and it isn't naming anywhere closer than the page already showing — it's the surname standing in for a page that has no ancestor to point past. Giving it the "you are here" colour was borrowing emphasis it hadn't earned. It's `isHome` now, and excluded from the last-crumb rule explicitly rather than by falling out of the general case.

## 69. Image notes keep the reconstruction and the evidence (2026-08-02)

**Decision:** a diagram embed followed immediately by
`<!-- image-note: original.jpeg -->` renders as one figure whose default view is
the cleaned-up bilingual diagram and whose second view is the photographed
handwritten source. The switch is a pair of native radios styled as one
segmented control, not a client component.

The syntax is deliberately asymmetric. Obsidian already knows how to display
the first line (`![[x.svg]]` or `![[x.excalidraw]]`) and hides the HTML comment,
so the vault remains pleasant to read without teaching Obsidian a custom block.
On the site, preprocessing sees both lines before either ordinary embed rule can
consume them and emits `.image-note`. The diagram/original state is local to the
figure, survives with JavaScript disabled, works by keyboard, and adds no state
store or hydration. Unique radio names include the language body's existing id
prefix, because both English and Ukrainian articles are present in the same DOM.

**The reconstruction is a view, not a replacement.** A cleaned graph is easier
to read, translate, theme, and fit to the page; the photo preserves handwriting,
cross-outs, spatial emphasis, and any transcription uncertainty. Both remain
ordinary lightbox items, but CSS uses `display: none` for the inactive view so
the gallery only collects what the reader can currently see.

**Creation workflow is clarified by decision #72.** Image notes use the normal
hand-authored, self-theming SVG workflow after a photo-extraction/transcription
step. Excalidraw remains optional rather than entering the default pipeline.

**Phone originals are sanitized before publication.** The source image is
orientation-normalized, resized to roughly 1600px on its long edge, and stripped
of EXIF/GPS/device metadata before entering `vault/`. The file is evidence for
the reader, not a reason to publish where and on what device the note was
photographed.

**Both views own one canvas.** The photo's width and height already exist in the
build-time image manifest. `imageNoteHtml()` writes that ratio onto the shared
stage, and the diagram and original are centered in the same grid cell. The
inactive view changes, but the figure's geometry does not, so a switch can never
move the controls, caption, or paragraph below it. Diagram authors also match the
SVG `viewBox` to the source ratio when practical, which uses that reserved space
rather than letterboxing it.

## 70. Formatting Playground is a published reference (2026-08-02)

Decision #43 correctly removed accidental scaffolding from the public site at
the time. The owner has now explicitly chosen to publish Formatting Playground
as the permanent, inspectable demonstration of every supported content feature.
Its `draft: true` flag is removed. The two Image-note demonstrations that first
lived there were later removed at the owner's request; the renderer and
authoring contract remain supported. `Post Sample` and `Draft example` remain
scaffolding/draft material; publishing this one reference does not change the
default rule that examples are hidden.

## 71. Image-note reconstruction is source-faithful and build-validated (2026-08-02)

**Decision:** every photographed-note diagram starts with a transcription map,
and every claim drawn in the final SVG must be supported by it. Layout may be
reorganized and obvious spelling/date formatting corrected, but explanatory
microcopy is not invented to make a sparse source feel polished. Unclear text is
confirmed with the owner or remains visibly uncertain. The map and correction
list are review material reported at handoff, not another persistent content
format beside the note.

The design remains interpretive in structure, not in facts. A chronology can
become a proper timeline and a hierarchy a tree, while one or two meaningful
source cues — a winding route, rupture, circle, or emphasis mark — keep the
result connected to the page it came from. This avoids both literal tracing and
a generic panel template while preserving decision #69's cleaned-view/source-
evidence relationship.

**The build validates what software can know.** `validate-image-notes.mjs` runs
before development and production asset sync. It checks referenced assets,
bilingual geometry and captions, photo aspect/size/privacy metadata, accessible
self-theming SVGs, dark-mode support, transparent canvases, unsafe/external SVG
content, and complete language/theme exports for directly embedded Excalidraw
drawings. Semantic fidelity and phone legibility still require the transcription
and visual review; pretending a validator can read handwriting would make the
automated guarantee dishonest.

The Markdown interface, native Diagram/Original switch, lightbox, and static
renderer do not change. Validation is an authoring/build concern and introduces
no runtime state, content database, or new dependency.

## 72. Photographed notes extend the semantic-SVG workflow (2026-08-02)

**Decision:** an Image note adds photo extraction before the existing diagram
recipe; it does not introduce a second drawing pipeline. Codex first records a
transcription map of exact text, dates, nodes, relationships, corrections,
cross-outs, and uncertainty. It then hand-authors `<name>.svg` and
`<name>.uk.svg` directly, using identical coordinates and the same internal
dark-mode, transparent-canvas, accessible-label pattern as
`rendering-pipeline.svg`.

An earlier iteration of this decision required bilingual Excalidraw scenes for
every photographed note. That requirement added an intermediate artifact
without improving the reader-facing static SVG or the source-fidelity review,
so it was reversed. Excalidraw remains supported when the owner explicitly
wants a visually editable drawing, and a directly embedded Excalidraw Image
note still needs the plugin's complete bilingual static exports. It is not a
prerequisite for a semantic SVG Image note, and the validator no longer expects
`.excalidraw` siblings beside `.svg` files.

The visual rules remain unchanged: translations share geometry; ordinary nodes
share a neutral treatment; a true semantic event or endpoint may receive a
different card treatment; text keeps explicit padding; and arrows appear only
for relationships that are genuinely directional. The source photo remains the
evidence, the transcription map owns factual fidelity, and the SVG pair owns
the cleaned reader-facing diagram.

## 73. Two agent files, one reference (2026-08-06)

**Decision:** Claude Code and Codex each keep their own auto-loaded entry file — `CLAUDE.md` and `AGENTS.md` — but only `CLAUDE.md` owns feature detail. `AGENTS.md` stays a thin map that defers to it, `docs/` stays shared and authoritative for both, and any change to a convention, command, or invariant must update both files in the same change.

**Why:** Each tool only auto-loads its own filename, so a single file can't serve both without one agent starting cold. Two hand-maintained copies of the same prose drift, and this pair already had: `AGENTS.md` went untouched through three later `CLAUDE.md` edits, leaving the two describing different `npm test` wiring (`lib/*.test.ts` via `test-resolve.mjs` vs. the actual `lib/*.test.ts scripts/*.test.mjs` via `test-hooks.mjs`), and `AGENTS.md` never learned about `npm run validate:image-notes` gating dev and build. Splitting by role rather than duplicating shrinks the surface that can drift to the map itself; a symlink was rejected because the two files genuinely want different lengths and framing.

**Also recorded there:** one agent at a time in this working tree. Obsidian Git auto-commits everything unstaged (`autoCommitOnlyStaged: false`) every 10 minutes and pushes, and Vercel deploys it — so two agents editing concurrently publish each other's half-finished work on a timer. Separate `git worktree`s if genuinely parallel work is wanted.

**Revisit when:** a third agent joins (then the shared rules probably want their own file both entry points include), or either tool learns to read a shared filename.

## 74. The left edge opens the sidebar (2026-08-10)

**Decision:** A 16px strip down the left edge of the window opens the drawer when the pointer reaches it, and the drawer closes again ~180ms after the pointer leaves it. The panel icon still opens it by click. One state (`openBy: "modal" | "peek" | null` in `components/Chrome.tsx`) records WHAT KIND of open it is: a deliberate one is a decision — modal, backdrop, focus trapped, stays until dismissed; the edge is a glance — no backdrop, no `aria-modal`, focus untouched, gone when the pointer is. Named for the kind rather than the input, because more than one input arrives at each (the icon and the `m` key both mean "modal" — see #75).

**Why:** The drawer holds the site's whole navigation and is closed at every width, so reaching it costs a click every time. The left edge is a target you can't miss (Fitts' law: infinitely tall, and the window edge stops the pointer for you), which is exactly why it must not be expensive to hit by accident. Hence the asymmetry: opening is instant, closing is delayed so clipping the corner on the way elsewhere doesn't slam it shut, and a peek deliberately does NOT take the keyboard — drifting past the edge of the window is not a request to move focus, and a stolen caret is far more disruptive than a panel that slid in.

Two smaller calls fall out of it. Clicking the panel icon while peeking promotes the peek to a modal panel rather than closing it: the pointer is on the button, the panel is already open under it, and "close" would read as the click having done nothing. And the strip is `display: none` outside `(hover: hover) and (pointer: fine)` — on a touch screen there is no hovering, and a live element on the left edge would swallow the browser's own back-swipe.

**Revisit when:** the drawer ever becomes a permanent rail at wide widths, which removes the problem this solves.

## 75. `m` opens the menu, and the keyboard opens it modally (2026-08-10)

**Decision:** `m` toggles the sidebar, listed in the `?` sheet beside `/` and advertised in the panel icon's tooltip the way ⌘K is on the search button. It shares `toggleMenu()` with the icon, so a keypress opens the panel MODALLY — backdrop, focus inside — not as a peek.

**Why:** #74 made the sidebar cheaper to reach with a pointer than with a keyboard, on a site that otherwise has a key for every kind of movement (`[`/`]`, `j`/`k`, `g h`, `g 1…9`, `l`, `/`). That asymmetry was created by the edge zone, so it belongs to the same change. The kind of open follows from the input's own logic rather than a rule: someone reaching for `m` is already on the keyboard and wants to arrow through the sections, which is exactly what the focus trap is for, whereas the peek exists precisely to keep the keyboard out of it.

`m` for menu over `\` (the editor convention for panels): on several European layouts `\` needs AltGr, and the handler drops anything with `altKey` set. A plain letter also matches every other shortcut on the site.

**Known gap, deliberately not fixed here — fixed in #77 the same day:** shortcuts read `e.key`, so under a Cyrillic layout `m` produces `ь` and did nothing, as did `j`, `k`, `l`, `g` and `h`. It was always one change to all of them or none, not a special case bolted onto the newest key.

## 76. The contents' reading line comes down to meet the end of the page (2026-08-10)

**Decision:** The table of contents highlights the last heading above a reading line 140px from the top of the window — but over the page's final screenful that line descends to the foot of the window, at exactly the rate the page runs out of scroll. Maths in `lib/toc-spy.ts`, covered by `npm test`; `components/Toc.tsx` measures the headings and asks it which one is active.

**Why:** A fixed line has a dead zone one viewport tall at the bottom of every page. The last screenful can't be scrolled up to the line, so any heading inside it never lights up — you are visibly at the end of the article and the rail is still pointing at the middle of it. It's worst exactly where the rail lives: 1280px and up, where the window is tall, the dead zone is 900px or more, and short closing sections ("Sources", a two-line conclusion) all fall inside it.

The alternative fixes were both worse. Highlighting the last heading whenever `scrollY` hits the bottom is a special case with a discontinuity in it — the rail jumps two rows at the last pixel of scroll. Shrinking the dead zone by moving the line down to the middle of the window makes every OTHER heading light up late, trading a bug at the end of the page for a mismatch through all of it. Sweeping the line keeps one rule ("the last heading above the line") and adjusts the only quantity that has actually changed: how much page is left. Because it descends at the rate the scroll is running out, it doesn't read as motion — the closing sections take their turn one after another, as if the page were still scrolling under a line that never moved.

A page too short to scroll keeps the resting line: with no "further down" to bring the line to, sweeping it would highlight the LAST heading of a page you just arrived at the top of.

**Also:** the click-hold (`held`) is still needed and its reasoning is now the opposite of what it was. It used to exist because a heading near the end couldn't reach the line; it now exists because several of them are above the line at once, so the spy would answer with a later heading than the one you clicked.

**Revisit when:** the rail ever gains its own scroll-into-view of the active row, which is where a moving line and a moving rail could fight.

## 77. Shortcuts read the character, then the key (2026-08-10)

**Decision:** Every keyboard shortcut goes through `shortcutKey()` in `lib/shortcut-key.ts`, which prefers `e.key` and falls back to the Latin label of `e.code`. `⌘K` in `components/Chrome.tsx` reads through it too. Pure and unit-tested, with the layouts themselves as the test cases.

**Why:** `e.key` alone is the character the layout produced, so under a Ukrainian layout the physical `l` types `д` and matched nothing — every letter shortcut on the site was dead for a reader typing in Cyrillic, which on a site where every note is translated is the reader most likely to be doing it. `e.code` alone is the physical key, which fixes that and breaks punctuation in the other direction: `/` is Shift+7 on a German layout and `?` is Shift+, on a French one, neither of them the key `e.code` calls `Slash`. Preferring the character and falling back to the key gets both, and needs no table of layouts.

The residual case is a layout that maps some other character onto one of our physical keys — a German keyboard's `-` sits on `Slash`, so it opens search. Outside a text field that key did nothing before, so the cost is a stray panel, against letter shortcuts that didn't work at all.

**Tested rather than tried:** a layout bug is invisible in the browser you're testing in, because you're testing in one layout. The test file names the layouts (`{ key: "д", code: "KeyL" }`) so the next person doesn't have to install a keyboard to see what's being claimed.

**Not changed:** handlers that only look for `Escape`, `Enter` and arrows — those key names don't move with the layout. Only `Shortcuts.tsx` and the `⌘K` listener needed it.

**Revisit when:** a shortcut is ever added on a character that isn't a letter, digit, bracket or slash — `SHORTCUT_CHARS` and the `e.code` map both need it, and the sheet is drawn for a US layout either way.

## 78. `rel="me"` on the social links (2026-08-10)

**Decision:** Every icon in `components/SocialLinks.tsx` carries `rel="me noreferrer"`, email included. `lib/site-config.ts` documents what that makes the `socials` list: the owner's own accounts, and only those.

**Why:** The site already stated its identity for machines — `sameAs` in the JSON-LD — but only in the form search engines read. `rel="me"` is the same claim in the form the rest of the independent web reads: it's what Mastodon checks before marking a domain verified on a profile, and what `rel-me` sign-in uses. One attribute, one list, no new surface.

The two claims differ in exactly one place, and correctly: `sameAs` filters out the `mailto:` because an address isn't a profile, while `rel="me"` keeps it, an address you control being precisely the identity it exists to claim.

**The invariant this creates:** a link in `socials` is an assertion of identity, not a bookmark. Adding a friend's profile, a project's account, or an org you belong to would inherit `rel="me"` and claim to BE them. Links like that belong in a note. Both files say so where someone would be editing.

**Only half of it lives here:** verification is bidirectional. The profile has to link back to the site for the pair to prove anything — this side is now done and stays done, the other side is a field in each profile.

**Revisit when:** a Mastodon or other fediverse account is added, which is where the attribute stops being latent and starts showing a green check.

## 79. Home types itself in, once per visitor (2026-08-13)

**Decision:** A reader's first ever visit to home opens on an empty page with the greeting being typed — `components/Intro.tsx`, cued by the sentence: the photo fades in the moment the first name lands, and a beat after the full stop the rest of the page sweeps in line by line and the chrome fades up around it. Once per browser, `localStorage`. Timing and cues are pure functions in `lib/intro.ts`, covered by `npm test`.

**The real heading is what types.** No overlay, no second copy of the sentence in a component. The `<h1>` the vault wrote is split into per-character spans in place and reassembled into a plain text node at the end. A component holding its own copy of "Hey, I'm Kyrylo Leshchenko." would drift from `vault/Home/main.md` the first time it was reworded, and an overlay would have to hand off to a heading in a different position. Untyped characters keep `visibility: hidden` rather than being absent, so the line wraps once, at the start, into the shape it finishes in — a typewriter that reflows the page under the reader is worse than no typewriter.

**Cued by the sentence, not a stopwatch.** `photoCue()` finds the first name in the greeting and returns the index just past it, so the photo lands on the right word after a rewording, in Ukrainian (a different name at a different offset), and at any typing speed. If the name isn't in the greeting at all it returns Infinity and the photo simply arrives with everything else — a greeting that doesn't say the name is a reason to drop the flourish, not to guess a moment.

**Hidden by an attribute, and only by an attribute.** Every rule hangs off `data-intro` on `<html>`. Nothing is hidden in the HTML: no JS, a crawler, or Reader mode all get the whole page. It follows that every failure mode ends with the page visible — which is the only acceptable way to put an animation in front of a site. It also makes the reveal atomic: dropping the attribute hands back the heading, the caret, the sweep and the chrome in one step, with no DOM surgery that could half-apply.

**Three ways it can end, on purpose:** any click, key, scroll or touch finishes it; the driver clears the attribute when the sweep lands; and the gate script carries its own 8s `setTimeout`, plus its own pointer and key listeners, so a driver that never arrives — a chunk that 404s, an error before hydration, a browser React never reaches — still hands the page back, and a reader who taps a page that looks empty gets something for it before hydration exists. `npm test` asserts the whole sequence (≈3.2s) stays well inside that failsafe, so it can only ever catch a fault, never truncate the real thing.

**Three flashes found by review, and what each one taught.** All three were invisible in the code and obvious the moment the sequence was stepped through frame by frame:

- *The finished sentence, then blank, then typing.* The gate hid the page around the heading but not the heading's own text, which only becomes hideable once the driver has split it into characters — and that happens at hydration, long after the server's HTML has painted. So the page opened by showing the answer and taking it back. The heading is now hidden outright until the driver adds `.tw`, i.e. until there are characters to hide instead.
- *A dark blink on the way out.* The chrome was hidden and revealed as `body > *:not(main)`, which also caught the elements that live in the DOM precisely BECAUSE they're invisible: the drawer's `bg-black/25` backdrop and the closed search and shortcut dialogs. Fading "the chrome" to opacity 1 therefore faded a quarter-black sheet over the whole page. The rules now name the three things actually on screen — `.skip-link`, `.chrome-bar`, `.edge-zone`. **Anything that manages its own visibility must be left to manage it**; the failure is silent and the blast radius is the entire viewport.
- *A caret left blinking after the full stop*, and on a skip, the untyped remainder snapping in at full opacity while everything around it faded. The caret is now scoped to the typing stages only, and the characters nobody waited for fade with the rest.

**The character spans are never put back.** Reassembling the text node would move it: splitting a line into one inline box per character can break shaping across the boundaries, so the kerned pairs in "Hey," and "Kyrylo" stop being kerned and the split heading sets a hair wider than the whole one. Restoring it would let the title settle by a pixel or two at the moment the reader is looking straight at it — the same class of glitch the intro exists to avoid. Left split, the layout during the typing IS the final layout and nothing ever moves. The spans carry no styles once the attribute is gone, `textContent` still reads the sentence, and the next visit renders the ordinary heading anyway.

**The skip fades, it doesn't cut.** Cutting from a near-empty page to a full one is the same jolt as everything else here. Skipping drops the stagger and runs one 160ms fade over the lot (`[data-intro-fast]`).

**Why the gate is in `app/layout.tsx` and not the page.** It has to run before the first paint or the reader sees the finished page for a frame and then watches it be taken away, and only an inline script in `<head>` is early enough — React hydrates long after the server HTML has painted. Position in the document is the whole point, hence the `location.pathname === '/'` check that keeps a home-only feature off every other page. The client half handles the other route in: somebody who landed on a post from search and then clicked home is still a first visitor, and a soft navigation never re-runs the gate — `useLayoutEffect` covers it, and on a soft nav that still runs before paint.

**Considered and rejected:** an overlay with its own copy of the text (duplication, and a hand-off that moves); typing the body character by character as well (the body is rendered HTML — links and embeds would have to be typed as whole units, so it can't be uniform, and a line-by-line wipe reads as fast typing without touching the markup); per-session rather than per-browser (the point is a first impression, and the third time it's a toll booth).

**Revisit when:** the home greeting stops containing the first name or gains inline markup (a link, a bold word — the driver stands down rather than flattening it); or `INTRO_KEY` changes. That key is written in two places, `components/Intro.tsx` and the gate script, because the gate runs before any module can be imported. Changing one and not the other makes every visitor new again.

**Also worth knowing:** Chrome renders `.skip-link`, `.chrome-bar` and `.edge-zone` as the only always-visible things beside `<main>`. New always-visible chrome has to be added to the intro's hide/reveal lists by hand — deliberately, since the alternative is the blanket selector that caused the dark blink. Getting it wrong leaves a stray control floating over an otherwise empty page, which is visible; the old failure forced hidden overlays open, which was not.

## 80. The sidebar note strip counts weeks, not days (2026-08-13)

**Decision:** The drawer's footer carries six months of writing as one bar per week — `components/Constellation.tsx` (server) → `components/ConstellationStrip.tsx` (client), bucketing in `lib/constellation.ts`, covered by `npm test`. Bar height is that week's note count against the busiest week in the window. Hovering a bar names the week and its count; clicking opens that week's notes as a list above the strip.

**Why it exists:** twenty-five notes spread across five folders read as a list. In time they read as a habit, which is the true thing about them and the thing the folder tree cannot show. It costs nothing to keep current — every note already carries `date:`, so the strip is built at build time and a new note grows a bar on its own.

**Why by week, and this is the whole decision.** It was built as a day grid first — GitHub's shape, one square per day — and looked wrong the moment it was pointed at the real vault: 25 notes on 5 distinct days, one of which held 14 because a batch of shelf notes was typed up in a single sitting. 170 empty squares around five specks reads as "abandoned". The data was fine; the resolution was a lie about it, because the day a shelf note is TYPED is not the day the book was read, and a day grid takes that clerical detail and makes it the whole picture. A week is coarse enough to absorb when things get written up and fine enough to show when work happened. The day-level grain is a real loss, and a vault this young has none to lose.

**Six months, because that is what fits.** The drawer is `w-56` with `px-6` gutters — 176px. Twenty-five bars at 6px with 1px gaps is 174px. The bar width, the gap and `WEEKS` are one decision written in two files, which is why both say so. A full-history version wants a page of its own, not this strip.

**Height carries the count, so tone doesn't.** Every bar is the same weight. Encoding the same number twice would be the only place on the site that shouts, and a green heat ramp here would be the one piece of colour on a monochrome page (#64).

**The count is hidden until you look at it.** A permanent "6 months · 25 notes" is a statistic the drawer has to justify every time it opens — and this drawer opens on a pointer brushing the edge of the window. It fades in on `:hover`, and on `:focus-within` so it isn't pointer-only. The line always occupies its height, so nothing moves when it appears.

**A week's own summary sits under ITS OWN BAR** — "16.07 · 14n", hanging below the strip at that column. Near the thing it describes, and out of the way of the range and total. Abbreviated because it has a 176px column and two things to say; the panel spells both out in full once a week is actually opened, and the button's `sr-only` name keeps the long sentence, so a screen reader never hears "sixteen dot zero seven, fourteen en".

It hangs into the section's bottom margin rather than reserving a line of its own. A reserved line pushed the strip up off the foot of the drawer, where the bars belong — they should sit above the social icons, not float over a blank row.

Positioning it per column is arithmetic, not measurement: every bar is 6px with a 1px gap, so the nth starts at n × 7px, handed to CSS as `--x`. Near the right-hand end a label would run off the drawer, so those hang the other way — right edge against the bar's, text growing left. Which way is decided in the component, since only the index knows how much room is left. The geometry constants therefore exist in `ConstellationStrip.tsx` as well as in the stylesheet, and both say so.

`shortDate` moved to **`lib/dates.ts`** to serve it. It already existed privately in `components/lists/PostRows.tsx`, and the obvious move — promoting it into `lib/vault.ts` beside `displayDate` — fails the build: `PostRows` is a server component but `PostListClient` renders it, so it ships to the browser and can't import a module that reads the filesystem. A pure date module is the thing both halves of the site can share.

Range first, total second — "6 months · 25 notes". The strip is a picture of a span of time, so the span is what frames the number rather than the other way round; and with the range leading, the line reads the same way as the axis it sits above.

It goes quiet entirely while a week is open (`data-open` on the section, below the hover rules so it wins by position). The list underneath names that week on the very next line, and two summaries an inch apart, answering different questions, is one more than the drawer can carry.

**A week opens a list; it doesn't guess.** The first version made each bar a link to the week's first note with the rest counted — `+13` — which picked a destination on the reader's behalf and hid thirteen. Clicking now opens the week directly above the strip so you choose where to land. ONE list refilled per week, not twenty-five in the HTML for the one that might be opened — no note titles are in the page until something is clicked. `inert` and `display: none` when closed, Escape to dismiss, and clicking the same bar closes it.

**And it's the sidebar's own rows, not a card.** It was a floating popover first, borrowed wholesale from the series panel (#42) — absolutely positioned, bordered, blurred, shadowed. For a handful of links inside a navigation drawer that reads as a different piece of software parked over the sidebar. They're now the same rows as the section list a few inches above, pulled out of the footer's `px-6` by `-0.75rem` so they land in the same column as it, with the same radius, wash and `.press`. One size down is the only deliberate difference: a section is one word and a note title is a sentence, and `text-lg` would ellipsise most of them away.

In the drawer's flow rather than absolutely positioned, which follows from being rows and not a card: the drawer is a column with a scrolling `nav` above, so an open week simply takes some of its room instead of covering it.

**Outside clicks close it, via a listener and not a backdrop.** A fixed overlay would sit on top of the navigation directly above this and eat the first click on every link in it. A `pointerdown` listener only listens: clicking the empty half of the sidebar closes the week, and clicking a section link closes the week AND follows the link, which is what someone doing it meant.

**The drawer sliding shut collapses the week too** — an open week is a thing you were looking at, not a setting, and finding one still open on the next peek is confusing about what the sidebar remembers. It's watched rather than told: the drawer stays mounted and merely translates off-screen, so the strip runs an `IntersectionObserver` on itself and closes when it is entirely off-screen. That keeps the two components uncoupled — the strip reaches Chrome as an opaque element, so there is no prop to thread — and it holds for every way the panel can go: the pointer leaving during a peek, the backdrop, Escape, a navigation. The default threshold matters here: it fires only when NO pixel is visible, so a partly-clipped strip on a short window can't close itself.

**Counted nouns needed their own module.** The strip read "13 липня 2026 р. · 11" for a while — a number with no noun on it, invisible to anyone reading the English. `lib/ui-strings.ts` holds pairs of finished sentences, and "14 notes" isn't one until you know the 14, so `lib/plural.ts` builds them: English's two forms and Ukrainian's three. The teens are the trap and the reason it's tested — 11–14 take `нотаток` despite ending in 1–4, while 21–24 do follow their last digit.

**The date above the list doesn't scroll with it.** The scroll sits on the `<ul>`, not on the block around it. With it on the container, the first row took the heading away with it — and that heading is the one line saying which week you're looking at.

**The section list outranks the week list.** In flow, whatever height an open week takes comes out of the `nav` above it, and the nav is what the drawer is FOR — getting to Posts or Shelf is the job; last July is a footnote. The list is capped at `min(28vh, 10rem)`, about five rows and comfortably shorter than the section list, with busier weeks scrolling inside it rather than growing. The card mode keeps its larger cap, since a floating panel takes no room from anything.

**Except where there's no room to push, where it becomes a card.** Taking space from the `nav` is right when there is space to take. On a short window the section list is already scrolling to fit, and a fourteen-note week would squeeze it to nothing — the sidebar's actual job, getting you to a section, crowded out by a footnote about last July. Under `max-height: 700px` the list lifts off and floats over the nav with the material the site's other popovers use. A HEIGHT query, not a width one: this is about vertical room, and a phone in portrait has plenty while a laptop in landscape often doesn't. The 639px case is the site's own phone breakpoint, kept so the two agree. The strip's height is shared as `--strip-h` between the strip and the card's `bottom`, so the card can't drift onto the bars.

**This costs the no-JS version, deliberately.** The bars were real links and worked without JavaScript; they're buttons now. A popover of choices is a control, not a destination, and there is no honest static form of "show me the thirteen other notes" in a 176px column. Keyboard access is kept properly instead: real buttons, `aria-expanded`, `aria-controls`, Escape, and an `sr-only` name on every bar. Empty weeks stay `aria-hidden` divs — "nothing that week" is not worth reading out twenty times.

**Split server/client, like PostList → PostListClient.** `Constellation.tsx` reads the vault, buckets, and formats both languages' dates; `ConstellationStrip.tsx` draws and holds the open state. That's what keeps `lib/vault.ts` out of the browser bundle, and it slims what crosses over to href, title and Ukrainian title — not whole entries with bodies and frontmatter.

**Rendered by the layout, not by `Chrome.tsx`.** `Chrome` is a client component, so importing the server half would drag `lib/vault.ts` and its `fs` calls into the browser anyway. It's passed in as an already-rendered element.

**`today` is a parameter, not a clock read.** The last column depends on it, and a component that reads the clock can't be asserted. It's the build date, which is right for a static site: "now" is whenever it last deployed.

**Revisit when:** the vault has a year or two of steady dates, at which point a day grid becomes worth having and probably wants a page rather than the drawer. Also if the shelf notes are ever re-dated to when things were actually read or watched — that alone would change what the honest resolution is.

## 81. Pull-quotes, and a layered blur on the floating chrome (2026-08-13)

**Decision:** Two things kept out of a batch of five — pull-quotes in the left margin (`> [!pull]` in `lib/markdown.ts`), and a blur that falls off at the edge on both floating bars (`.chrome-bar` and `.toc-bar`). A drop cap, a rule drawn under each heading, and parallax on the shelf covers were built alongside them and removed; the last section here says why that's worth recording.

**Pull-quotes reuse the sidenotes' gutter, to the pixel.** `> [!pull]` — a callout, so Obsidian still shows it as a quote — becomes an `<aside class="pullquote">` floated into the left margin at 1280px and up, with the same width, the same `-14.5rem` pull and the same `clear: left` as a sidenote, so a quote and a footnote in the same paragraph stack instead of landing on one another. The callout's title becomes the attribution, and unlike every other callout there is no generated one: "Pull" is not a thing anybody wants printed above their own sentence.

Below 1280px it stays in flow as an emphasised quote rather than disappearing. That's the difference from a sidenote, which can fall back to the list at the bottom of the page: a pull-quote is part of the argument, so it has to stay somewhere a reader can reach it.

**The chrome's blur is layered.** One flat `backdrop-filter` ends exactly where the element does, so a pill over a page of text reads as a frosted stamp sitting on it: sharp, abruptly soft, then sharp again along a hard rim. Two layers — a gentle one across the whole surface, a stronger one masked to fade out toward the edge — let it fall off instead, and the chrome sinks into the page rather than covering it.

The `z-index: -1` layers need their parent to be a stacking context so they sit above its background and below its text rather than vanishing behind the page — and all three already are, each being positioned with a `z-index` of its own. The first version added `isolation: isolate` to each anyway, to say so out loud. **That is the one property that must not be there:** isolation forms a BACKDROP ROOT, which is exactly the boundary `backdrop-filter` stops sampling at, so the layers would have blurred the surface's own fill and nothing behind it. The effect and the property that silently disables it were one line apart.

All three share one set of rules — the breadcrumb top-left, the contents pill bottom-left and the sidebar are the same material, and the two pills were already built to the same height (#51).

**The sidebar takes one uniform blur, not the graduated pair.** It was given the same two layers first, with the fall-off running sideways instead of radially — full height, one edge against the page, so fading toward the right seemed like the same idea rotated. It isn't. Across 224px the gradient is wide enough to see: heavily blurred on the left, barely on the right, with the transition visible as a seam down the middle. It reads as two panels side by side rather than one that dissolves, and it's most obvious while the panel slides, which is what made it look like an animation bug.

The graduation is for a surface small enough that its edges are most of it. A pill floats free and every side is an edge, so softening them is what stops it reading as a stamp on the page. A full-height panel already has a hairline saying where it ends, and one even blur behind it is the whole of what it needs.

**The sidebar stopped being a door.** It was a flat panel of `--bg` with a hairline down its right edge — opaque, and either open or shut. On the same translucent fill it reads as a layer over the page: you can still see where you were, which is the honest description of a panel you opened by brushing the edge of the window and will lose again the moment you move away.

Two details had to move with it. The hairline is a `box-shadow` rather than a `border`, so it takes part in no layout and the panel is exactly `w-56` — the constellation's strip is measured against that width to the pixel (#80). It has to be an INSET shadow: an outset one sits outside the box, and this box spends most of its life translated fully off-screen with its right edge exactly on x=0, which put a 1px line down the left of the window on every page of the site.

**And the modal backdrop had to be left alone, after two goes at "fixing" it.** A dimming layer under a translucent panel tints the panel, so it was first stopped at `left-56`, then given a transform tracking the slide so its edge met the panel's at every frame. Both were solving the wrong problem. A translucent panel over a dimmed page IS darker — that is what a sheet looks like on every platform there is. What's actually wrong is stopping the dim at the panel's edge: the page then reads bright THROUGH the panel and dark immediately beside it, so the sidebar looks like a window cut out of the page rather than a layer over it.

That's the doubled edge, and the way it was reported is what identified it: it showed when opening with the ICON and not when peeking from the edge. The two paths differ in exactly one thing — the peek has no backdrop — so the backdrop was the only suspect left. The dimming covers the whole viewport again, the panel included.

**Revisit when:** a pull-quote is wanted on a page whose gutter belongs to something else — the geometry is copied from `.sidenote`, and the two would have to move together.

## 82. Home's breadcrumb is gone, not shortened (2026-08-20)

The bar at the top-left named home with the surname — "Leshchenko", "Лещенко" (#68). It's removed: on home the chip is the panel button alone, and `homeName` is gone from `lib/site-config.ts` with it.

**A crumb is a trail, and home's trail is empty.** Every other page's crumb answers "where does this sit" and links somewhere you aren't. Home's linked to `/` — the page already showing — so it was a word that could not be used, occupying width in the corner the eye lands on first, on the one page whose job is to be uncluttered. #68 had already noticed half of this, when it stopped giving that crumb the "you are here" colour because it hadn't earned the emphasis; this is the rest of the same observation.

**The label cell isn't rendered at all on home, rather than emptied.** `.bar-swap` is a grid cell sized by its contents, so an empty one still carries `padding-right` and the pill would keep a few pixels of dead space on its right. `crumbs.length > 0` gates the whole span.

**And the chip's padding is NOT conditional, which was the first attempt and was wrong.** With one 32px button and no label, `px-1.5` leaves a 44×40 pill rather than a circle, so the padding was tightened to `px-1` on home to square it up. That moves the button 2px to the left the instant you arrive. The chip is the only piece of chrome that survives a navigation intact and the button is the only thing in it that's on every page — reported immediately as the bar "moving for a bit" when switching to home, because a fixed control shifting under the pointer while the page behind it is still settling is exactly the motion a fixed control must not make. The padding is constant now and home's chip is a pill. Squaring it the other way is worse: growing the height to 44 breaks the 2.5rem this bar shares with `.toc-bar` (#51), and moves the button vertically instead.

Note what does still change: the pill's right edge, which goes from the width of "Kyrylo · Posts" to the width of the button in one frame. That's a content change and it's meant to be instant — animating it would be a chip resizing itself in the corner of the eye on every navigation, which is #52's mistake in a new place. Nothing that persists across the navigation moves; only the part that's leaving.

**Nothing was lost with it.** The name is the `<h1>` two lines below in the vault's own words ("Hey, I'm Kyrylo Leshchenko."), the sidebar wordmark still carries it, and `authorName` — not `homeName` — is what feeds JSON-LD and RSS. The breadcrumb's structured-data twin never emitted home anyway (#40).

**Revisit when:** a page other than home ends up with zero crumbs. The padding rule keys off `crumbs.length`, not off `isHome`, so it would follow correctly — but the round chip currently reads as "this is home" and that meaning would stop being true.

## 83. The edge peek waits 90ms before it opens (2026-08-20)

Brushing the left edge of the window slides the sidebar out (#—, the `peek` state). It used to open on the first `pointerenter`, with no delay at all; it now waits `PEEK_DELAY` = 90ms of dwell, and cancels if the pointer leaves the strip first.

**Instant is wrong for a target you can hit without meaning to.** The strip is 16px wide and the full height of the window, and it is invisible — so it collects every throw of the pointer at the browser's back button, every overshoot on the way to a link near the left margin, and every pass across the screen that happens to end short. Each one slid a panel out over the page the reader was looking at. The strip has no affordance to say "don't come here", so the correction has to be in time rather than in space; widening or narrowing it trades one of those failures for the other.

**90ms buys intent, not deliberation.** A pointer thrown at the edge is still settling at 90ms and the 300ms slide starts from under it either way, so a move made on purpose still feels like the panel was already there. A pointer merely crossing the strip is gone before the timer fires. It is deliberately not a hover-intent heuristic measuring velocity or angle — the shortest dwell that separates arriving from crossing is the whole of what's needed, and a heuristic would have a wrong answer to be wrong with.

**The open and close delays are asymmetric on purpose** — 90ms in, 180ms out. Opening by accident costs the reader the page they were reading; closing by accident costs them the thing they were reaching for. The second is the more annoying of the two, so the cheap mistake gets the short fuse. (Re-entering the strip while an open is already pending does NOT restart the clock: the dwell that has been accumulating is the one that counts.)

**Three places had to drop a pending open**, and each was a real reversal rather than tidiness: the panel button overlaps the strip, so reaching for it arms a peek on the way, and a click that CLOSED the panel would be undone 90ms later; Escape pressed with the pointer still resting in the strip would be undone the same way; and unmount left a timer holding a `setState`.

**Revisit when:** the strip's width changes. The delay and the width are one setting between them — a wider strip is easier to enter by accident and would want longer, a narrower one is hard enough to hit that the dwell stops earning its keep.

## 84. "New" is measured against your last visit, not against the clock (2026-08-20)

**Decision:** A note dated after the day you were last here carries a small **New** chip in the posts list and in home's recent-posts list. The marker lives in one localStorage key (`notes-seen`), the maths is `lib/new-notes.ts` (tested), and the chip is `components/NewBadge.tsx`.

**A fixed recency window was the other option, and it says nothing about you.** "Posted in the last 7 days" needs no storage and could even be server-rendered, but a reader who comes every day sees the same badges all week, and one who comes back after a month sees none at all. The badge is only worth having if it answers *what have I not seen*, which is a question about the reader — so the site has to remember the reader, and the only thing it can remember is this browser.

**The marker advances once per SESSION, not once per page load.** Stamping it on arrival is the obvious implementation and it destroys the feature: the first page you open clears every badge, so you only ever see them on whichever list you happened to land on. A gap of more than `SESSION_GAP_MS` (30 minutes) starts a new visit; anything shorter is the same visit, so the badges survive a reload and a browse around. The answer is also memoized for the life of the page, so a soft navigation doesn't clear the row you were looking at.

**A note dated D is read as having arrived at the END of day D**, and that is compared against the previous visit's timestamp. Comparing two local `YYYY-MM-DD` strings was the first version and is the tidier-looking one; see the outcome below for why it had to go. End-of-day is the generous reading of a day-granular date, and generosity is the right direction here: showing a badge one visit too long is a far better failure than never showing it.

**Nothing older than 30 days is ever badged, however long you have been away.** Strictly, everything published since your last visit IS new to you — but come back after a year and every row says New, and a list where everything is new is a list where nothing is. The cap is the admission that this is a nudge, not an inbox.

**A first-ever visit badges nothing.** There is no previous visit to be new since, and marking the whole list on arrival tells a first-time reader the opposite of what the chip means.

**The chip is monochrome, unlike the amber Draft chip beside it.** Draft only ever appears in `npm run dev` — it is a warning to the author, and the one place a colour is allowed to shout. New is part of the published page, which has no accent colour (#64). It takes the outline of an inactive filter chip, which is this design's quiet chip; a filled one built from `--surface` disappeared into the row's `--bg-hover` wash on hover.

**It renders client-side only**, like every other reader-state signal here (`components/Series.tsx` and its read counts). `PostRows` is rendered on both sides — it is the Suspense fallback for `PostListClient` — so the badge had to be its own client component rather than a hook, or the whole list would have become client-only and the static HTML that crawlers and JS-off visitors get would have shipped empty.

**Revisit when:** posting rate changes. The 30-day cap assumes a note every week or two; at a note a day it is too generous, and at one a quarter it hides things that really are unseen.

### Outcome (same day): the day-string comparison never fired for regular readers

The first version compared the note's `date` against the local `YYYY-MM-DD` of the previous visit, strictly. That is wrong in one specific and important case, and it was found the way these things usually are — by publishing a note and not seeing the badge.

A reader is here at 09:00. A note goes up at 14:00, dated today. They come back at 20:00: the line reads `2026-08-20`, the note reads `2026-08-20`, `>` is false, no badge. Tomorrow the line advances past it for good. **The note never badges for that reader at all** — and "that reader" is whoever visits most often, which is precisely backwards for a feature whose entire purpose is rewarding a return.

The fix is to stop rounding both sides to a day. The stored marker keeps the previous visit's TIMESTAMP (`prevAt`), and a note dated D is read as arriving at the end of D. The evening visit above now sees `23:59 > 09:00` and badges.

The cost is real and bounded: a note dated on the day of your previous visit stays badged one visit longer than it strictly should — seen Tuesday evening, still badged Wednesday, gone Thursday. That is the trade taken deliberately.

The original worry that motivated day-strings — a day-granular date compared against a millisecond clock flipping across a timezone offset — was real but was solved at the wrong end. Rounding the VISIT down to a day threw away the information that mattered; rounding the NOTE up to the end of its own day keeps a stable meaning in any timezone.

`parse()` still reads the day-string shape that briefly shipped, converting that day to its end, so a browser that loaded the first version carries on rather than losing a cycle. It can be deleted once no browser can plausibly still hold it.

### Outcome: every section but `now` carries it, in one of two shapes

The first version rendered in the posts list only, and shelf and people were left out with the note that a card is artwork rather than a row of text. That turned out to be the whole design problem, not a reason to skip them.

**A row of text takes the chip; a card takes a mark on its cover.** `NewBadge` has two variants. `chip` follows a title — posts, projects (the TIL feed), music, and home's recent list — and is the monochrome outline described above. `cover` is for shelf and people, where there is no room after a title and no predictable colour underneath: it becomes a pill on the artwork in exactly the material the shelf's "Reading" badge already uses (`.shelf-status`), because that badge had already solved this problem — a dark scrim and a blur, the one place on a monochrome page where white-on-black is right, since the thing behind it is a photograph.

**The two cover marks take opposite corners.** `.shelf-status` is top-left, `.cover-new` top-right, and they share one rule block so they cannot drift apart. A book you are part-way through that also arrived since your last visit carries both, and neither has to know about the other.

**`now` is deliberately excluded.** It is a status page about the present, not a list of arrivals — everything on it is current by definition, so a New mark there says nothing. `NowList` mounts no badge.

**The date had to be carried onto two view models.** `ShelfItem` (`lib/shelf.ts`) and `PersonRow` (`components/lists/PeopleCards.tsx`) are slimmed-down projections of an entry, and neither kept `date` — nothing had needed it. Both now carry it, which is the only change outside the components themselves.

**Revisit when:** a new section type is added. The rule is not "every list gets a badge" — it is that a list of ARRIVALS gets one, and a page about the present does not.

## 85. The hover card gives every cover its own shape (2026-08-20)

**Decision:** The link preview card (#12) no longer crops its cover into a fixed 44 × 66 portrait beside a column of text. The image floats, the excerpt wraps under it, and it is sized from its own intrinsic ratio — carried in the index as `coverAr` — inside a box of 80 × 84: `width: min(5rem, calc(5.25rem * var(--cover-ar)))` with a matching `aspect-ratio`. Width leads for a tall paperback, height for a wide banner, and nothing is ever cut.

**A 2:3 box is a guess about book covers, and the vault disagrees with it.** The covers actually in `.image-manifest.json` run from 0.60 (a tall Hemingway paperback) through 0.63, 0.68, 0.76, 0.81 — and then 1.00 for the square portrait on the People note, and 5.05 for a show's logo banner. The old box was right for none of them and beheaded the portrait, which is the one image on the site where a face is the whole content. Sizing from the real dimensions costs nothing: `dimsFor()` already reads them at build time for `rehypeImageSize`, so this is a number the site had and wasn't using.

**A cover that can't fit gets smaller, never cropped.** The `min()` is the whole rule: past the cap the height gives way instead of the image. Mr Robot's 5:1 banner renders 80 × 16 — a sliver, and an honest one. A remote `cover: https://…` has no build-time size, so it falls back to 2:3 with `object-fit: contain` — letterboxed rather than cut, since the fallback is a guess and a guess should not be destructive.

**The cover floats because the alternative is a column of nothing.** In the flex row it was, a 66px image sat beside an 85px block of text with 19px of empty card under it, and any attempt to stretch the image to close that gap meant cropping again. Floated, the excerpt flows under the cover once it clears — the card is exactly as tall as its contents, whichever of the two is taller.

**Which is why nothing inside the card may set `overflow` or `display: -webkit-box`.** Both establish a formatting context, and a box with its own formatting context is laid out *beside* a float in the space left over — it never flows under. The title and excerpt were `-webkit-box` line clamps and had to go, or the float would have bought nothing. `EXCERPT_CHARS` bounds the card's height instead, dropped from 180 to 140 now that it is the only thing doing so. There is a comment saying this above the rule; it is the kind of thing that gets "tidied" back in.

**The cover is served from the responsive copies.** It paints at ~80px and was loading the original — a 1000 × 1000 PNG for the portrait. `srcSetFor()` was already there; the card just passes it a `sizes` of `80px`.

**A card with no artwork shrinks to its text.** 320px was a fixed slab, so hovering a link to Now — whose entire description is "What I'm focused on right now." — produced the same rectangle as a three-paragraph book note, and the difference was empty card. `width: fit-content` with a `13rem` floor and the 20rem ceiling makes that one 208px wide and 86px tall; anything with a real excerpt still measures past the ceiling and looks exactly as it did.

**Cards that DO carry artwork keep the full ceiling, via `data-cover`.** Shrink-to-fit and floats don't mix: the cover is out of flow, so it contributes nothing to the card's max-content width — the card measures its text alone, then squeezes the cover into what's left and wraps a title that had been fitting. The component sets the attribute because it is the one place that already knows whether there's a cover; `:has()` would have worked too, but a card that silently reflows on browsers without it is a worse failure than an explicit flag.

**Revisit when:** a section type wants a cover with a wildly different shape again — the 80 × 84 box is sized for the covers this vault has, and it is one `min()` to move.

## 86. A shelf note opens with the person who made it (2026-08-23)

**Decision:** Every entry in a `shelf` section — book, film, show, video — renders a creator block above its own body: a round portrait, the role, the name, and one or two sentences. `entryCreator()` in `lib/shelf.ts` reads it out of frontmatter (`author:`, plus the new `author_uk:`, `author_photo:`, `author_bio:`, `author_bio_uk:`), `components/Creator.tsx` draws it, and `app/[section]/[slug]/page.tsx` mounts it between the header and the article. Posts and People get nothing: a post's author is Kyrylo, which the whole site already says, and a People entry *is* the person.

**The role is derived from the medium, never written per note.** A book has an author, a film has a director, a show has a creator, a video has a channel — and the note already declares which medium it is, through `medium:` or the folder it's filed in (`entryMedium()`). Writing the label by hand would be a second place to get it wrong, and it would be monolingual: the labels live in `lib/ui-strings.ts` as `{en, uk}` pairs like every other fixed string. Ukrainian gets `Автор серіалу` for a show rather than the bare `Автор` a book takes — the two are the same word otherwise, and the longer one is what the credit reads.

**It sits above the fact table, and took that table's first row with it.** Every shelf note opened with a two-column table whose first row was `| Author | Yuval Noah Harari |`. That row is now the block, in both languages, so it was deleted from all fifteen notes and their `.uk.md` siblings — leaving it would have printed the same fact twice, six lines apart. The table is a list of facts about the *work* (published, read, one-liner); a maker is a different kind of thing and stops being one line of type indistinguishable from a publication year. What survived the deletion is the detail those rows carried beyond the name — `Valerii Markus (published as Valerii Ananiev)` is now a clause in his bio, not a lost parenthesis.

**Every field below the name degrades on its own.** No `author_photo:` falls back to initials on the card surface; no `author_bio:` leaves the role and the name standing. `author:` stays the only required key, which is why adding the block to the site invalidated no existing note. Four notes shipped on initials at first and none do now — see the cascade below — so that path renders nowhere in the vault, which is why `creatorInitials()` lives in `lib/shelf.ts` with tests rather than privately inside the component. Untested code that nothing renders is code that breaks silently the first time somebody needs it.

**Initials take the first and LAST word, unlike the People grid's first two.** A surname is the half you recognise, so a middle name must not push it out — "Yuval Noah Harari" is `YH`, not `YN`. Anything after a `|` is dropped first: a channel written `Nate Herk | AI Automation` would otherwise take its second letter from the tagline.

**Finding a portrait is a cascade, and the first four failures were the cascade stopping at step one.** English Wikipedia's `pageimages` returns whatever is in the infobox, which for Richard Bach is his *signature* — so "no portrait" was wrong for three of the four. What actually works, in order: other languages' Wikipedias (`pl` and `nl` both carry a Bach portrait `en` does not), then a direct Commons file search, then `prop=globalusage` to confirm a file whose caption names two people is really the one twenty Wikipedias use as his portrait, then the creator's own site. **And for a video, the channel's own YouTube avatar** — `oembed → author_url → that page's og:image`, keyless, two requests, served 900 × 900 and already square. An avatar is right exactly where a photo of the host would be wrong: `author:` names the *channel*, so Marques Brownlee's face under the byline "WVFRM Podcast" is the wrong picture with the right person in it. The Waveform logo is what that channel looks like, and a channel's avatar identifying that channel sits on the same footing as a book cover or a poster.

**The portrait keeps its colour, and does not borrow `.person-photo`.** The People grid holds its photographs at `grayscale(0.3)` and returns them under the pointer (#56) — a hover-only exception, so the page at rest stays monochrome. Nothing here is hoverable, so that class would mean grey forever, which is the thing #56 exists to avoid. And the precedent that fits is the covers: a shelf page already carries full-colour artwork at rest, and one 72px face is not the wall of colour a grid of portraits would be.

**A row, not a card.** No border, no fill, no radius. The fact table directly below was a framed block at the time, and two of them stacked at the top of an article read as a dashboard rather than the opening of something you're about to read (that table has since been unframed too — #87). A hairline and space separate it, which is the pair the entry footer already uses.

**A `<div>`, not a `<section>`.** A section earns its landmark only if it can be named, `aria-label` takes one string, and this site renders *both* languages into every page — so any name would be English for a Ukrainian reader. The role and the name are visible text and are read in order regardless.

**Photos are square-cropped on the way in, not by `object-fit`.** The eleven portraits fetched from Commons are stage shots, press photos and conference stills; centred cover-cropping put half of them off-frame. They were cropped to the face and written out at 320 × 320 before entering the vault, which also strips EXIF and drops the set to ~190 KB total. Files live in one shared `vault/Shelf/creators/`, not per-medium `covers/` folders — the asset index is keyed by basename vault-wide, so an author appearing under two mediums would otherwise be two copies of one file.

**The rating moved off the title and onto the metadata line at the same time.** It was `<Stars>` beside the `<h1>`, where a row of 16px glyphs had nothing to align to against a 46px serif and turned the one line of the page that is a sentence into a sentence plus a score. On the meta line it is the same kind of thing as everything else there — a fact the note records about itself — and it reads as "watched on this date, rated this". It sits straight after the date: shelf entries carry no reading stats or maturity, so in practice the two are adjacent, and the `#tags` stay last where they were.

**And the filled stars went grey with it.** They were `--text`, which beside a title is the emphasis the page has instead of an accent colour (#64) — but on a metadata row it made the score the darkest thing on the line, louder than the date it sits next to. `--text-tertiary` is what that row is already set in. The empty stars stay `--border`, still far enough apart in both themes to read a half at 13px. This lands on the shelf CARD too, which is the same argument: a rating under a cover is metadata, not a headline.

**Revisit when:** a creator wants a link. Wiring the name to a `People` note where one exists is the obvious next move and was deliberately left out — `getWikiIndex()` already resolves names, so it is small, but it changes the block from a fact into navigation and that is a separate decision.

## 87. A headerless table is a fact list, not a data table (2026-08-23)

**Decision:** A markdown table whose header cells are all empty is tagged `fact-table` at build time (`rehypeFactTables` in `lib/markdown.ts`) and rendered as plain rows — no border, no radius, no row dividers, no filled header strip, label column in `--text-tertiary`. Tables with real headers keep the card treatment they always had.

**Obsidian has no syntax for a headerless table, so this vault fakes one, and that fake shape is a reliable signal.** Every fact block opens `| | |` — 34 tables across Shelf and People do, and exactly two tables in the vault have real headers. That is not a coincidence to be exploited; it is the convention already in the content, and it happens to draw the line in exactly the right place. A table you read ACROSS wants a frame and a header strip. Two or three key–value rows do not.

**But shape alone was not enough: it is SHELF ENTRY PAGES ONLY.** The plain treatment is opt-in through `RenderOptions.factTables`, passed by `app/[section]/[slug]/page.tsx` when `isShelfSection(section)`. The first version keyed on shape alone and quietly restyled the People notes too, which was wrong — not because those tables look bad plain, but because the problem being solved does not exist there. What made the card too heavy is the creator block (#86) sitting directly above it: two framed objects stacked before the first sentence. A People note has no creator block, no stacking, and no reason to change. A rule derived from one page's problem should not travel to pages that don't have it.

**Which means the empty-`<thead>` question splits too.** Shelf entries delete the row in the pipeline; everywhere else `.prose thead tr:not(:has(th:not(:empty)))` still hides it, exactly as before. That `:has()` rule stays because it is still the only thing standing between a People note and a strip of blank column headers.

**The `## At a glance` heading is gone from the shelf, and only from the shelf.** Deleted from all sixteen notes and their `.uk.md` siblings, so a shelf body now opens straight with the table. It was a two-word label sitting over three rows of facts, one line under the creator block, at the same weight as `Why it's on the shelf` — a real section of writing. Once the table stopped being a card, the heading was the loudest thing left in the block and the only thing still announcing it. The facts say what they are. **People notes keep their heading**, because there the block is a genuine section of a longer profile and nothing sits above it competing.

**The side effect is fewer ToC rails, and that is fine.** `MIN_TOC_HEADINGS` is 3, so notes that had exactly three headings now have two and show no outline. Those are notes whose outline was "At a glance / Why it's on the shelf / Quotes" — the first of which pointed at a three-row table. The threshold exists because below it an outline is noise; a heading that was padding the count out of the way is the threshold working.

**The card was making three short facts the loudest thing on the page.** Bordered, rounded, divided and topped with a filled strip, directly under a creator block that is also boxed (#86), before the reader had reached a sentence of the note. Two framed objects stacked at the top of an article read as a dashboard — the same argument that kept the creator block a row rather than a card, applied to the thing sitting under it. Stripping the furniture leaves rows of type, which is what they were all along.

**The label column lost its weight as well.** It was `--text` at 500 — the same colour as the value beside it, so both halves of every row asked to be read equally and neither won. At `--text-tertiary` it reads as a label and the eye goes to the answer. The first cell also loses its left padding: a frameless table indented by a phantom 1rem looks like a mistake, so the list now hangs on the prose margin.

**The empty `<thead>` is deleted in the pipeline, not hidden in CSS.** It used to be `.prose thead tr:not(:has(th:not(:empty)))`, a `display: none` that still shipped a row of blank column headers to a screen reader — and leaned on `:has()` for something a build step can simply decide. This removes a `:has()` dependency rather than adding one, which is the direction #85 argues for.

**Below 480px the rows stack, label over value.** The label column is `white-space: nowrap`, and on a phone it wins the fight for width by squeezing the value into a two-word column. Stacking is the only honest answer at that width; there is still no frame.

**Revisit when:** a note wants a genuinely tabular table with no header, on a shelf entry. It can't have one there — that shape means "fact list" on those pages. The escape hatch is to give it a header, which such a table wants anyway. Everywhere else the shape still means nothing.
