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

**Decision:** Cmd+K search runs over a build-time JSON index passed as props (no backend, no client fetch). Sitemap/robots/RSS/OG images are all generated at build. OG images use `next/og`; their current editorial treatment and embedded Source Serif font are recorded in #106.
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

**"Open this note on GitHub"** links at the note's raw vault source, in whichever language is being read (a note without a translation falls back to the English file). `repoUrl`/`repoBranch` live in `lib/site-config.ts` beside the socials; clear `repoUrl` and the action disappears. The path comes from `data-vault-source` on the entry page's wrapper — the same read-the-page approach as the prev/next shortcuts (#34), and for the same reason: the palette is global, and threading every entry's file path through the layout would create a second source of truth. **It depends on the repo being PUBLIC**, which it was not for a stretch: `lib/site-config.ts` called it a public repo in a comment while `gh api repos/Kryloss/vaultsite --jq .private` said `true`, so every reader who wasn't the owner followed that action to a GitHub 404 — signed in as the owner it looks perfect, which is exactly why nobody caught it. The repo was made public rather than the action dropped (2026-08-25); the two are one decision, so if the vault source ever goes private again, clear `repoUrl` in the same change.

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

`ogImage()` takes an optional cover and splits the card: text left, artwork right. The frame follows the medium — tall for covers, 16:9 for videos, and later square for Music — and the author gets a line when one exists. #106 replaces the original full-bleed treatment with a mounted object and `object-fit: contain`: real jackets do not all share an exact 2:3 ratio, so preserving every edge matters more than filling every pixel of the approximate mount.

**The image is inlined as a data URL, not linked.** These are generated *during* the build, when there is no server running to serve the site's own `/vault-assets/` files — a relative path renders as nothing, silently. Remote YouTube thumbnails are passed through, since Satori fetches those itself.

**Every failure path is a shrug.** Unknown format (Satori decodes no WebP or AVIF), missing file, unreadable — `ogCover()` returns undefined and the note falls back to the text card. A preview image that throws would fail the build of the page it belongs to, which is a steep price for a picture.

**Shelf and Music only.** A post has no cover, and the photograph on a People note is a person's face, which is not a thing to paste into a link preview.

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

**A row, not a card, and the hairline is not its own.** No border, no fill, no radius. The fact table directly below was a framed block at the time, and two of them stacked at the top of an article read as a dashboard rather than the opening of something you're about to read (that table has since been unframed too — #87). A hairline and space separate the note's header matter from its writing — but that line sits under the FACT TABLE, not under the creator. The creator and the facts are the same kind of thing, both about the work rather than part of it, so the rule belongs beneath the pair. Drawn between them it split a group that reads as one and made the first fact row look like the opening of the article.

**A `<div>`, not a `<section>`.** A section earns its landmark only if it can be named, `aria-label` takes one string, and this site renders *both* languages into every page — so any name would be English for a Ukrainian reader. The role and the name are visible text and are read in order regardless.

**Photos are square-cropped on the way in, not by `object-fit`.** The eleven portraits fetched from Commons are stage shots, press photos and conference stills; centred cover-cropping put half of them off-frame. They were cropped to the face and written out at 320 × 320 before entering the vault, which also strips EXIF and drops the set to ~190 KB total. Files live in one shared `vault/Shelf/creators/`, not per-medium `covers/` folders — the asset index is keyed by basename vault-wide, so an author appearing under two mediums would otherwise be two copies of one file.

**The rating moved off the title and onto the metadata line at the same time.** It was `<Stars>` beside the `<h1>`, where a row of 16px glyphs had nothing to align to against a 46px serif and turned the one line of the page that is a sentence into a sentence plus a score. On the meta line it is the same kind of thing as everything else there — a fact the note records about itself — and it reads as "watched on this date, rated this". It sits straight after the date: shelf entries carry no reading stats or maturity, so in practice the two are adjacent, and the `#tags` stay last where they were.

**And the filled stars went grey with it.** They were `--text`, which beside a title is the emphasis the page has instead of an accent colour (#64) — but on a metadata row it made the score the darkest thing on the line, louder than the date it sits next to. `--text-tertiary` is what that row is already set in. The empty stars stay `--border`, still far enough apart in both themes to read a half at 13px. This lands on the shelf CARD too, which is the same argument: a rating under a cover is metadata, not a headline.

**Revisit when:** a creator wants a link. Wiring the name to a `People` note where one exists is the obvious next move and was deliberately left out — `getWikiIndex()` already resolves names, so it is small, but it changes the block from a fact into navigation and that is a separate decision.

## 87. A headerless table is a fact list, not a data table (2026-08-23)

**Decision:** A markdown table whose header cells are all empty is tagged `fact-table` at build time (`rehypeFactTables` in `lib/markdown.ts`) and rendered as plain rows — no border, no radius, no row dividers, no filled header strip, label column in `--text-tertiary`. Tables with real headers keep the card treatment they always had.

**Obsidian has no syntax for a headerless table, so this vault fakes one, and that fake shape is a reliable signal.** Every fact block opens `| | |` — 34 tables across Shelf and People do, and exactly two tables in the vault have real headers. That is not a coincidence to be exploited; it is the convention already in the content, and it happens to draw the line in exactly the right place. A table you read ACROSS wants a frame and a header strip. Two or three key–value rows do not.

**But shape alone was not enough: the plain-list STYLING is shelf entry pages only.** The plain treatment is opt-in through `RenderOptions.factTables`, passed by `app/[section]/[slug]/page.tsx` when `isShelfSection(section)`. The first version keyed on shape alone and quietly restyled the People notes too, which was wrong — not because those tables look bad plain, but because the problem being solved does not exist there. What made the card too heavy is the creator block (#86) sitting directly above it: two framed objects stacked before the first sentence. A People note has no creator block, no stacking, and no reason to change. A rule derived from one page's problem should not travel to pages that don't have it.

**Which means the empty-`<thead>` question splits too.** Shelf entries delete the row in the pipeline; everywhere else `.prose thead tr:not(:has(th:not(:empty)))` still hides it, exactly as before. That `:has()` rule stays because it is still the only thing standing between a People note and a strip of blank column headers.

**The `## At a glance` heading is HIDDEN, everywhere, and not deleted.** It was a two-word label over three rows of facts at the same weight as `Why it's on the shelf` — a real section of writing — and once the table stopped being a card it was the loudest thing left in the block and the only thing still announcing it. The facts say what they are.

**Deleting it from the markdown was the first attempt and it was wrong.** That shipped: the heading was cut from all sixteen shelf notes and their `.uk.md` siblings. Two things broke. The table of contents lost the row — and the outline is the one place a label like this genuinely earns its keep, because there it is the only thing standing for the block. And `MIN_TOC_HEADINGS` is 3, so half the shelf dropped to two headings and stopped showing a rail at all. A heading is not just its painted text.

**So the element stays and only the paint goes.** `rehypeFactTables` tags it `fact-heading`; CSS clips it. Clipped rather than `display: none`, which would take it out of the accessibility tree and out of the scroll-spy's measurements — `position: absolute` keeps its static position, so the spy still finds the block where the reader sees it, the anchor still resolves, and it contributes no height or margin of its own. Measured: heading and table share a viewport top to the pixel.

**And this half runs on EVERY section, not just the shelf.** The words are redundant wherever the block appears, so a People note's heading is hidden too — while its table keeps the card (that split is what `plain` gates). The plugin therefore always runs now; only the plain-list styling and the rating row are shelf-only.

**The card was making three short facts the loudest thing on the page.** Bordered, rounded, divided and topped with a filled strip, directly under a creator block that is also boxed (#86), before the reader had reached a sentence of the note. Two framed objects stacked at the top of an article read as a dashboard — the same argument that kept the creator block a row rather than a card, applied to the thing sitting under it. Stripping the furniture leaves rows of type, which is what they were all along.

**The label column lost its weight as well.** It was `--text` at 500 — the same colour as the value beside it, so both halves of every row asked to be read equally and neither won. At `--text-tertiary` it reads as a label and the eye goes to the answer. The first cell also loses its left padding: a frameless table indented by a phantom 1rem looks like a mistake, so the list now hangs on the prose margin.

**The empty `<thead>` is deleted in the pipeline, not hidden in CSS.** It used to be `.prose thead tr:not(:has(th:not(:empty)))`, a `display: none` that still shipped a row of blank column headers to a screen reader — and leaned on `:has()` for something a build step can simply decide. This removes a `:has()` dependency rather than adding one, which is the direction #85 argues for.

**Below 480px the pair RUNS ON instead: "Published 2011 (English edition 2014)" as one line of text.** Two columns don't survive the width — a `nowrap` label wins and squeezes the value into a two-word column. Stacking label OVER value was the first answer and it costs two lines per fact regardless of how short the fact is, so three facts became seven lines and the note's opening filled a 812px screen before a word of the writing. Run on, `Read July 2026` is one line and only a genuinely long value takes two: same three facts, four lines. It stays legible because the label was never distinguished by the line break — it is smaller, tertiary and always first, which is the whole job.

**The creator block re-flows on phones too, and that is where the height actually was.** The bio drops BELOW the photo and name to run the full measure; only the role and the name stay beside the face, because they are short and they are what the picture captions. Squeezed into the column left over by a 56px circle the bio wrapped to four or five lines, so the narrow layout cost more height than the wide one — the photo saved 16px and the text spent 40. The re-flow is a grid, which needs `display: contents` on `.creator-text` (the bio is nested inside it, and a grid only positions its own children); safe on a plain `<div>`, which has no semantics to dissolve.

**And the flex `gap: 1rem` had to be explicitly reset to `row-gap: 0` there.** In the grid that gap becomes a ROW gap, which is 16px — almost exactly the slack the photo has over two rows of text — so the role and the name were strung out across the face rather than sitting together against it, and the "compact" layout came out 15px TALLER than the one it replaced. A shorthand inherited across a `display` change is the kind of thing that looks like a rendering bug and reads like a design choice.

**Together: 362px of header matter down to 288px on a 375px screen**, and the first heading of the actual writing moved from below the fold to 530px — on screen. The desktop layout is untouched.

**Revisit when:** a note wants a genuinely tabular table with no header, on a shelf entry. It can't have one there — that shape means "fact list" on those pages. The escape hatch is to give it a header, which such a table wants anyway. Everywhere else the shape still means nothing.

## 88. The rating is a fact, so it lives in the fact list (2026-08-23)

**Decision:** A shelf note's `rating:` renders as the last row of its fact list — `Rating ★★★★½` — appended by `rehypeFactTables` (`lib/markdown.ts`) rather than rendered on the metadata line under the title. The geometry moves to `lib/stars.ts`, shared by that plugin and `components/Stars.tsx`, which still draws the rating on a shelf card.

**Third placement, and the first one that answers what the rating IS.** It sat beside the `<h1>` (a row of glyphs with nothing to align to against a 46px serif, turning the one line of the page that is a sentence into a sentence plus a score), then on the metadata line (better, but a graphic mid-sentence, and on a phone it pushed the tags onto a second line and stranded a separator at the end of the first). The fact list was the answer all along: `Published 2011 / Read July 2026 / Rating ★★★★½` is one thought — what it is, when you read it, what you made of it. The metadata line goes back to date and tags, which is what it was before any of this.

**It has to be injected, because a note cannot write it.** `rating:` is frontmatter, and the fact table is markdown. So the plugin appends the row, taking the localised label as an option the way `anchorLabel` already is — `ui.ratingRow`, English on the English body and Ukrainian on the Ukrainian one. Appended, not prepended: the facts come first and the verdict closes them.

**The half star is a nested-`<svg>` clip, and that is what let one shape serve two renderers.** The old component built four nested spans per star with a percentage width and an absolutely positioned overlay — impossible to mirror sanely in hast. Now it is one row of five outline stars, then the same row again in the filled colour inside a nested `<svg>` whose width is the rating: a nested svg clips to its own viewport under `preserveAspectRatio="xMinYMid slice"`, so there is **no `<clipPath>` and therefore no id**. That matters more than the tidiness — a shelf grid renders a dozen ratings on one page, and generated SVG ids are the classic way for them to quietly clip each other.

**Two renderers is deliberate, not a duplication that got away.** One is React, one is a rehype plugin over a syntax tree; neither can call the other. What would drift is the path and the arithmetic, and those are in `lib/stars.ts` with tests. Each renderer is a dozen lines of plumbing over it.

## 89. The header block is one column, not two stacked (2026-08-23)

**Decision:** On a shelf entry the creator's portrait grew to 6rem and its gap to 2rem, so its text starts at exactly 8rem — which is `--fact-label`, the fixed width of the fact list's label column. The creator's name, the bio, and every fact VALUE now begin on the same vertical line.

**The column had to be fixed, and `width` alone does not fix it.** Under the default `table-layout: auto` a width on a cell is a hint the algorithm may overrule: the English column settled at 112px and the Ukrainian one at 119px, so the two languages did not line up with each other, never mind with the creator above them. `table-layout: fixed` makes the column exactly `--fact-label` and makes an over-long label wrap inside it instead of shoving the value column right — a graceful failure rather than a silent one.

**8rem is set by Ukrainian, not by English.** `Одним рядком` is 103px against `Published`'s 67px, and script coverage decides layout numbers here the same way it decides typefaces (#59, #61). A 4.5rem photo beside a 1rem gap put the line at 88px, which wrapped it.

**The photo grew for free.** The role, name and bio beside it already run taller than 96px, so a bigger portrait costs no height at all — it just stops looking small next to a 46px title.

**Phones keep their own layout and got tighter again.** The portrait drops to 3rem there, the bio still runs full width below it, and the fact pairs still run on (#87). Together with the rating leaving the metadata line — which stops that line wrapping — the note's opening runs 362px to 299px, and the first heading of the actual writing sits at 523px on an 812px screen.

**Mr. Robot got a real poster, and `coverFit: contain` now has no user.** It was a freely licensed 5:1 title logo standing in for cover art — the one card on the shelf that wasn't a 2:3 cover, and the shape that forced the hover preview to grow a whole sizing system to avoid beheading it (#85). Kyrylo supplied the official poster; it is filed at 400 × 600 like every other cover and the frontmatter drops `coverFit`. The FEATURE stays — a note may still have nothing but a banner one day — but the docs no longer point at Mr. Robot as the example, and the guidance now calls it a last resort rather than a shrug, because the fix here was simply to ask for the art.

**Revisit when:** a fact label longer than `Одним рядком` appears. It will wrap inside the column rather than break the alignment, which is the point, but 8rem is one number to move.

## 90. The music page borrows Apple Music's shapes, not its palette (2026-08-24)

**Decision:** `/music` gets two things from Apple Music. The notes list becomes a track list — square album art at 44px, then title and date on one line with the description spanning the full text column beneath — with its divider starting at the TEXT column rather than the row's edge. And the list sits in a CARD whose colour is the newest note's cover, blurred past recognition and clipped to it. Entries carry the art in a `cover:` key, resolved by `resolveCoverUrl()` exactly as the shelf and people lists resolve theirs.

**It was full-bleed behind the page header first, and moving it into the card is what settled #64.** The first build ran the wash across the window behind the title — the one place on the site where colour reached page chrome, which needed a paragraph of justification and a standing note that a monochrome audit should leave it alone. Contained in the card it needs neither: the artwork is inside a frame again, like every cover, portrait and diagram here, and #64 stands exactly as written. It also does a job it couldn't do before — a tinted, bordered surface makes the list read as one object, which is what the shape is borrowed from. The wash still isn't an ACCENT: nothing is tinted to match it, no state or control reads from it, it carries no meaning. It is the artwork of a note in the list, out of focus.

**It recolours itself, which is the point and also the risk.** The wash is `rows.find(r => r.cover)` over a newest-first list, so publishing a note repaints the card. Nobody maintains it and it can never go stale. The cost is that the page's colour is chosen by whatever album is newest — a very bright cover will wash louder than a muted one, and there is no per-note control. If one ever fights the text, the answer is to lower `opacity` on `.music-wash img`, not to add a knob to the frontmatter. The mask deliberately stops at 35% rather than reaching transparent: a tint that fades out entirely leaves a coloured band with a plain list under it, which is two things, not a card.

**No stacking context anywhere in it.** The wash is an earlier SIBLING of the list inside `.music-card`, so `position: relative` on the list is the whole ordering mechanism — no `z-index`, no negative layer, and no `isolation: isolate` (#81). The full-bleed version needed all of that: a containing block on `main` via `:has()`, `z-index: -1` to get behind unpositioned text, and care that the negative layer didn't escape. Containing the wash deleted the machinery along with the exception.

**The hover had to stop being `--bg-hover`.** It is opaque, so on a tinted card it stamped a grey block over the colour for the length of whichever row was under the pointer. The rows use `color-mix(in srgb, var(--text) 7%, transparent)` instead — translucent, so the tint reads through, and built from `--text`, so it darkens on a light card and lightens on a dark one without a second token (#64).

**The typeface is the tell we deliberately did NOT borrow.** Apple Music is SF Pro, tight and sans; this page stays Source Serif 4, because script coverage decides typefaces here and it decided once already (#59, #61). The recognisable part of an Apple list turned out to be geometry, not type: the inset divider does more work than any font would have.

**The counted subline (`1 note · 1 playlist`) shipped and was cut.** It was Apple's hierarchy without Apple's typeface, and free from data already on the page — but a section page whose header the list component cannot reach put it under the intro prose and above the embed, where "1 note" sat a screen away from the one note it counted. Two of the three numbers a reader could see were also `1`. `playlistCount()` went with it; `noteCount()` stays, the constellation uses it.

**No play triangle, on rows or on cards.** Apple puts one on every one. Here the row opens a NOTE — nothing plays — and a control that lies about what it does is a worse failure than a missing resemblance. The hover is the site's own `--bg-hover` wash and nothing else.

**The rows are placed by grid AREA, and that is what saved the phone layout.** The first build stacked title and description in a wrapper beside the date; on a 375px screen the Ukrainian date (`17 липня 2026 р.`) left the description 140px — four words and an ellipsis. Placing the four children into `"art title date" / "art desc desc"` gives the description the date's width back: 279px on a phone, and at desktop it stopped being truncated at all. Dates stay FULL here, since DD.MM is posts-only.

**Entry descriptions are translated from `meta`.** `Entry` models no `descriptionUk` — only `Section` does — so no list has ever shown a translated description, though the notes write `description_uk:` anyway. The row reads it out of `entry.meta`, the documented escape hatch, rather than widening the engine's model for one section type. **Revisit when:** a second list wants it, at which point it belongs on `Entry` for everyone.

**The album row was specified and deliberately not built.** A horizontally scrolling row of square covers is the most Apple-looking thing available and it is nearly free — `components/lists/ShelfRow.tsx` with the aspect changed from 2:3 to 1:1. It waits on content: `vault/Music/` holds one note, and a shelf row with one card reads as broken rather than as a shelf. Build it at four or five.

**Covers come from the iTunes Search API**, which needs no key: search the album, take `artworkUrl100`, swap `100x100bb` for `600x600bb`. Filed in `vault/Music/covers/` like every other cover, so `sync-assets.mjs` produces the WebP variants and the blur placeholder with no extra step.

## 91. A music note opens like a shelf note (2026-08-24)

**Decision:** `/music/<note>` gains the four things a shelf note has and it didn't: an artist block above the body, a plain fact list, a square OG card, and `MusicAlbum` JSON-LD. It also tints its own opening with its own cover, which no shelf note does. One predicate — `opensWithHeaderBlock()` in `lib/shelf.ts` — gates the first two.

**The key the note writes is what picks the role, so nothing needed to learn about sections.** `entryCreator()` used to read `author:` and derive the role from `medium:`. It now reads `artist:` first and falls back to `author:`, and the KEY that matched selects the role: `artist:` says Artist, `author:` keeps the medium lookup. Everything below the name follows the same prefix (`artist_photo:`, `artist_bio_uk:`, …). The alternative was passing the section in, which would have made a presentational helper depend on the routing layer to answer a question the frontmatter already answers. A music note therefore needs no `medium:`, and a shelf note is untouched.

**One predicate for the creator block AND the fact-list styling, not two.** #87 established that the plain list is opt-in *because* the creator block sits above it and two framed blocks stack badly — they are two halves of one decision. Gating them separately is exactly how that pairing would come apart later, so `opensWithHeaderBlock()` answers both, and the docstring says why. Music joined because an album has a maker and a handful of facts, which is a book's shape.

**The note's wash is a WASH; the section's is a CARD. That difference is load-bearing.** The section page frames its tint (#90) because the track list is an object you look at. A note's tint sits behind `.creator`, which is deliberately a row with no border, fill or radius (#86) — framing it here would have reversed that decision by the back door and put a dashboard at the top of an article. So this one dissolves on all sides via a radial mask and adds no height whatsoever. The falloff is 140% × 100%, wider than tall: the page column is narrow, and a circular falloff pinches the colour into a stripe down the middle of the text.

**Shelf notes deliberately do NOT get the wash.** Their artwork is already the card in every list that links to them; a second, blurrier copy behind the title says nothing new. Music is the case where the cover is otherwise only a 44px thumbnail.

**`wide?: boolean` became `coverShape`, which is the change that stops the next shape being a second boolean.** The OG renderer had `wide` switching two numbers between a 2:3 jacket and a 16:9 thumbnail. An album is 1:1, and a third case cannot be expressed as a boolean — a `square` flag beside `wide` would have made "both true" representable and meaningless. The three shapes are now one lookup table beside each other, and the panel padding stopped being a conditional at the same time.

**The rating row and the artist block are exercised by different things.** The rating renders through the shelf's existing plugin path with no new code, and was verified by temporarily setting `rating: 4.5` on the Clancy note and then removing it: a score is an OPINION and inventing one for the owner is the one edit content work never makes. The note carries the key commented out instead, so it is an invitation rather than a claim.

**Album facts have a keyless source, like the art.** `itunes.apple.com/lookup?id=<album>&entity=song` returns the release date, track count and label (inside `copyright`), and summing `trackTimeMillis` gives the running time. So the fact block is a lookup rather than a research task, the same way `artworkUrl100` → `600x600bb` made the cover one.

**Revisit when:** a second section wants translated entry descriptions. `Entry` still models no `descriptionUk` and the music list reads it out of `meta` (#90); at two callers it belongs on `Entry` for everyone.

## 92. The note's colour spreads; the embed's footer goes (2026-08-24)

**Decision:** Three small corrections to the music work. The note's wash moves from `.page` to `main` and spans the window rather than the 39rem column. The entry OG card's subtitle flips to `Kyrylo · Music`. The "Open in Apple Music" link under every embed is removed.

**Framed on the section, dissolving on the note — the pair now says something.** #90 pulled the section's wash INTO a card, and #91 kept the note's wash unframed but stopped it at the text column, which was neither one thing nor the other: too contained to read as light, too edge-less to read as a panel. Window-wide it finally states the distinction the two pages were reaching for. The track list is an OBJECT you look at, so it has edges. A note's colour is the ROOM it is read in, so it has none. Both are still artwork out of focus and neither is an accent (#64).

**`main`, and therefore no `100vw` anywhere.** `main` is already the full width of the window, so `left: 0; right: 0` is full-bleed by construction — no negative-inset trick, and no way to produce the horizontal scrollbar those tricks cost when a scrollbar is present. `:has()` keeps the containing block on the one route that has a wash. `z-index: 0` on `main` is load-bearing, not decoration: without it the `-1` layer escapes the page's stacking context entirely.

**Wider needed deeper and softer, not just longer.** Stretched across a window at the old height the wash read as a horizontal BAND — a stripe of colour with a page under it. Height went to `clamp(340px, 55vh, 600px)` and blur from 56px to 72px. The mask ellipse also inverted, from 140% × 100% to 85% × 100%: a falloff wider than its own box has nowhere left to fade and ends at a rim, which was fine in a narrow column and wrong across a window.

**The OG subtitle read backwards from the page it linked to.** The card said `Music · Kyrylo` while the breadcrumb above the same note said `Kyrylo · Music`. Same separator, opposite order — the site's own trail runs owner-first, so the card now does too.

**The embed's footer link was ours, and Apple already had one.** It shipped so a stalled gray-skeleton embed was never a dead end (#10). But a LOADED player carries "View in Apple Music" and "View in App" inside the iframe, and our link sat directly beneath them saying the same thing a third time. **The cost is real and worth writing down: the stalled case now has no way out.** If the gray skeleton returns, this is the first thing to restore — `ui.openInAppleMusic` is parked in place, already translated, and `.apple-music-footer`, `.apple-music-fallback` and its `.prose` underline exception were deleted with it.

**Both washes fade in; neither cuts.** A field of colour arriving at full strength was the one thing on these pages that did not move like the rest of them — `.page-in` is already fading the article in around it. The entrance is `--dur-slow`, the step meant for things that travel far, rather than a fourth duration typed at the call site (#58).

**One keyframe, and it names only the START.** `@keyframes wash-in { from { opacity: 0 } }` with `animation-fill-mode: both` ends on the element's OWN computed opacity — 0.30 in light, 0.36 in dark, 0.30 for the section card — so the keyframes never learn a value they would then hold wrong. Writing the obvious `to { opacity: 0.3 }` would have silently flattened dark mode to the light figure, which is the kind of bug that only shows up on the theme you weren't looking at. Measured after the fact: 0 → 0.22 → 0.31 → 0.36 across the 320ms in dark, resting at 0.30 in light.

**Nothing was needed to let readers listen in a post — they already could.** The pipeline turns a standalone Apple Music link into a real player: previews for anyone, full tracks for a signed-in subscriber, no API key, no developer account, and no JavaScript of ours. A song link (`?i=…`) gets the compact 175px player and an album or playlist the full 450px one, which `appleMusicEmbedHeight()` already picks between — the Clancy note now uses both, one track as an example and the album under it. What is NOT possible without paying is a custom player or a play-this-word link mid-sentence: that needs MusicKit JS, which needs a developer token, which needs the paid programme and a runtime secret — both of which this site is built to not have.

## 93. The wash's own rim was the line you could see (2026-08-24)

**Decision:** Both washes size their artwork with a fixed `--wash-bleed` (120px on the card, 180px on the note) instead of `transform: scale()`, and the mask moves from the image onto the box. The track-list card also answers the pointer with a firmer outline.

**`blur()` fades an image out at its own edges, so the rim has to be outside the box.** A CSS blur samples beyond the element and finds transparency there, which means every blurred image has a soft transparent border of roughly its own blur radius. Inside a clipped box that border is visible as a faint line where the colour stops — which is exactly what showed across the card. `transform: scale(1.2)` was supposed to push it out and could never have: on a 190px row it moves the rim 19px against a **48px** blur. The bleed is stated in the same units as the blur it has to clear, so the two can be compared by reading them.

**`max-width: none` on those images is load-bearing.** The first version bled correctly in one axis only — the reset's `img { max-width: 100% }` silently capped the width while the explicit `height` sailed through, so the top and bottom rims vanished and the left and right ones stayed. The measurement said 120px of vertical bleed and 0px of horizontal, which is the kind of half-fix that looks like the technique failing rather than one property winning.

**The mask belongs on the box, not on the artwork.** Once the image hangs 120–180px past what you can see, a mask on the image measures its percentages against a rectangle the reader has no access to — a `radial-gradient(… at 50% 0%)` would start its falloff 180px above the visible top edge. On the container the geometry stays tied to the visible box, and the two can be tuned independently.

**The card's outline answers the pointer before any row does.** `--border` deliberately retreats (#59), which is right at rest and left the list looking like the page rather than like an object once it had a tint. On hover the border firms to `--text` at 20% and takes a 3px ring at 5%: monochrome, from the same token every other state uses (#64), and transitioned by NAMED properties — a `transition:` shorthand there would sit below `.press` in this file and reset the transform its own rows are pressed with (#52). It is the CARD that responds and never the heading above it, which is type, not a control.

**Apple's song player does not reflow — it clips.** Measured at four heights: 175px is Apple's own compact size and fits everything; 150px still shows every control including the legal line; 130px trims that line and a sliver of artwork; 110px cuts the Play button in half. So there is no smaller *variant* to ask for, only a shorter window onto the same fixed layout, and 150px is the floor worth using.

## 94. The album is the subject, so it sits in the margin (2026-08-24)

**Decision:** On a music note, the ALBUM player moves into the right gutter — the contents rail's column and geometry — from 1400px up. A SONG player never moves. On the section page the playlist embed loses its wrapper card and fills the text column edge to edge. The hover outline added to the track-list card in #93 is removed; it was a misread of the request.

**Album and song are different kinds of thing, and the URL already says which.** An album or playlist is what the review is ABOUT: it belongs beside the whole note, not at the paragraph that happened to name it. A song is an EXAMPLE of a sentence and stops being one the moment it is not next to that sentence. `isAppleMusicSong()` (the `i=` track id, or a `/song/` URL) was already deciding the player's height; it now also stamps `data-kind` on the block so CSS can place the two differently without re-parsing anything.

**1400px, not the rail's 1280px, and the gap gives way before the width does.** The rail is 13rem, which is right for an index and too narrow for a two-column player. The player takes 18rem and starts 1.5rem past the column instead of the rail's 2.5rem — it needs the width more than it needs the air. That reaches 39rem past centre, which only clears a window comfortably from about 1400px. Between 1280 and 1400 the rail is out and the player simply stays in the writing, which is the layout the page had all along.

**Scoped by a class on the page, not by the block's own markup.** `.music-note` is set from `section.type` on the entry route, so an album link pasted into a POST keeps its place in the writing. The pipeline stays type-agnostic; only the page that has this problem opts in.

**Our wrapper around Apple's widget was a frame around a frame.** The playlist embed sat in a `--surface` card with a border, a radius and a shadow — and Apple's widget draws its own rounded card inside that, so what you saw in dark mode was a ring of our surface around their player, with neither reaching the column edge. The iframe is the element now.

**The card hover outline from #93 is gone.** It answered a request I had misread: the ask was about the playlist widget, not the track list. Removed rather than left in — an unasked-for state on a list of links is a thing readers have to learn for no reason.

**Verified by measurement, and NOT visually — say so.** Position, width, the 1400px boundary and the column fit were all measured in the browser (288px wide, 48px from the column, 96px to the window edge, back in flow at 1399px, no overflow at any width). But Apple's embed served only its gray skeleton for the whole of this session's later testing — in the page, in a fresh tab, and at the embed URL loaded directly — so **how the album player itself renders at 18rem is unconfirmed**. It is Apple's own responsive layout inside an iframe we cannot style. If it looks cramped at that width, the number to move is the `width` in the 1400px block, and the gap at `left` is what pays for it.

## 95. On a phone the album is a corner icon, not a slab (2026-08-24)

**Decision:** Below 640px a music note's album embed is hidden and replaced by a square headphones pill in the top-right corner; tapping it hangs the full player under the icon. In the gutter the desktop player moves up to `top: 7rem` and down to `16rem` wide. Embed iframes gain `loading="lazy"`.

**A 450px player is most of a phone screen, and it was landing mid-sentence.** The corner is where this site already puts per-page controls — the contents pill and the floating breadcrumb are both 2.5rem there (#51) — so the album joins that family instead of interrupting the writing. The glyph is `HeadphonesIcon`, which is the Music section's own sidebar icon, so the control names itself without a label.

**Two pills cannot share one corner.** A music note usually has too few headings for a contents rail, but "usually" is not a layout. `.page:has(.toc-bar) .music-pill` steps the album left by exactly one pill and its gap when the outline rendered. The page is asked whether the rail exists, which is the only thing that decides it.

**`loading="lazy"` is what makes hiding it free.** A `display: none` iframe still fetches; a `display: none` LAZY iframe never enters a viewport and so never loads at all. Without that, hiding the inline album on phones would have swapped a visible 450px player for an invisible download of the same thing — the worst of both. The sheet's own iframe is gated behind the first tap, so a reader who never opens it pays nothing either.

**The sheet is the ToC sheet, not a new pattern.** Always mounted so it can animate shut, shown by `data-open`, `inert` when closed, contents behind first open, Escape and a backdrop tap to dismiss. Copying the pattern is the point: a second dialog idiom on the same page is how two of them drift.

**The gutter player settled at 5rem / 20rem wide / 23rem tall, after two passes.** It began at `9rem` and 18rem, which started it level with the note's BODY while the title sat above it — pinned to the wrong thing. It is now ABOVE the page's own content (`--page-y` is 7rem at this width), which nothing else contests, because the floating breadcrumb is `left-3`.

**Wider and shorter, not smaller.** A 16rem × 450px box in a margin is a tall narrow slab — the wrong proportion for a thing standing beside a page rather than in it. The width went UP to 20rem and the height DOWN to 23rem, which is the shape a two-column player wants and the extra width should buy. The gap gives way to pay for it: 1rem off the text column instead of 1.5rem.

**The height is a clip, and clipping is safe here in a way it would not be at the top.** Apple's player does not reflow (#93), so `height: 23rem` trims from the BOTTOM — the artwork, the title and the Play button are the top two thirds and all survive; what goes is the tail of the track list, which the note is not about. `--gutter-player-h` is stated once and read three times: the box, the iframe filling it, and where the contents rail has to start.

**Still 1400px, and now with room.** At the tightest supported width the player leaves 52px to the window edge, and 72px at 1440px. The variables are scoped INSIDE the 1400px block, so a phone's hidden inline embed keeps `height: auto` and none of this leaks down.

**Still unverified, and the same caveat as #94: Apple's embed served only its gray skeleton throughout.** Every structural fact here is measured — the pill is `flex` below 640px and `none` above, the inline album is `none` on a phone, the sheet opens with `inert` cleared and its iframe mounted at 450px, the sheet's top edge meets the pill's bottom edge exactly, the desktop player is 320 × 368px at `top: 5rem` with no overflow at 1400px or 1440px — but **what the player looks like inside those boxes is not something this session could confirm.**

## 96. The Play button is the last thing in Apple's player (2026-08-24)

**Decision:** The gutter player's height clip is reverted — it takes the iframe's own 450px and nothing shorter. On phones the corner pill wears the album cover instead of the headphones glyph and is a rounded square rather than a circle, and the sheet drops its border, padding and fill.

**The clip took the control, not the tail.** #95 shortened the gutter player to 23rem on the reasoning that "the artwork, the title and the Play button are the top two thirds". That was wrong about the layout: Apple stacks header, album row, track list, and **Play last** — so a short box removes the one control the player exists for, and leaves the part you can read anywhere. Clipping is only ever safe against content whose tail is expendable, and this one's tail is the button. `--gutter-player-h` survives solely to place the contents rail below the player; the box itself no longer has a height of ours. **The player's height is not a knob** — the note is in `CLAUDE.md` so this is not re-derived a third time.

**A square, because a round crop of a square cover is a worse picture of the record.** It took `--r-md` instead of `--r-full`, and later came down to **2.25rem** against the contents pill's 2.5rem — a cover is a picture and does not need the tap target a bare glyph does. Its `top` gains back the 0.125rem the height lost, so the two pills stay centred on the same line as the breadcrumb bar opposite rather than merely sharing a top edge (measured: both centres at y=32). The headphones glyph stays as the fallback for a note with no `cover:`.

**The cover earns that spot on a phone specifically.** On a phone the reader has seen no artwork at all: the inline embed is hidden (#95) and the wash is blurred past recognition by design. The pill is the only place the record shows its face, which also makes the control self-describing in a way a generic glyph was not.

**The sheet was a frame around a frame, exactly like the section page's playlist had been (#94).** Border, padding, translucent fill and a blur, wrapped around a widget that draws its own rounded card — so the player floated inside a second card with a dark rim. All of it is gone; what remains is a drop shadow, which lifts the player off the page without drawing an edge. Its `max-height` also went to 80vh so the sheet can never become the thing that clips the player.

**Measured after:** desktop 320 × 452 at `top: 5rem`, bottom at 532px on a 900px window; the phone sheet has `border-width: 0`, `padding: 0`, a transparent background, and holds the full 450px iframe inside its own bounds. The 437px I first measured on that iframe was the sheet's opening `scale(0.97)` caught mid-transition, not a clip.

## 97. The players follow the reader's theme, and shrink by scaling (2026-08-24)

**Decision:** Every Apple Music embed URL gains `theme=auto`. The gutter player is scaled to two thirds rather than resized. Track players are capped at 20rem instead of filling the column.

**`theme=auto` is the site's own theming model, handed to Apple.** Verified against Apple directly before writing any code: the same embed URL renders a dark player on a dark system and a light one on a light system — the skeleton itself changes colour, so it is decided inside the iframe by `prefers-color-scheme`. That is exactly how this site themes (#62: OS only, no toggle), which means the players match the page with **no JavaScript, no second copy of the markup for the other theme, and nothing that stops the site being static.** The alternative considered — rendering a light iframe and a dark one and letting CSS pick, the way `<T>` does for language — would have been idiomatic here and is simply not needed. Appended with `&` when the link already has a query, which a song link always does (`?i=<track id>`).

**Smaller had to mean SCALED, because it could not mean shorter.** #96 established that cutting the box takes the Play button, which is last in Apple's layout. `transform: scale(0.6667)` makes the player 1.5× smaller on the page while the iframe still renders at its full 20rem × 450px — so every track row and the Play button survive at two thirds size. Painted footprint 213 × 301. This is the general shape of the answer for any embed you cannot restyle: change how big it is drawn, never how much of it there is.

**`transform-origin: top left` pins it to the gutter's own edge** — the one the contents rail shares. Shrinking therefore pulls the player away from the WINDOW rather than away from the writing, so the column keeps its neighbour and the extra space falls where there was already nothing.

**The rail's offset reads the PAINTED height.** `--gutter-player-h` is 300px, not the iframe's 450px: a transform does not change layout, so anything positioned against the player has to be told the visual size rather than the box.

**A track player was the widest thing in its own paragraph.** It is an EXAMPLE of a sentence (#94), and a full-column player made the example louder than the point. 20rem is a little over half the 39rem column and, deliberately, still above the ~300px Apple's compact player wants — half exactly (288px) would have squeezed it below that. On a phone the column is already narrower, so the cap stops applying on its own and nothing needed a media query.

## 98. `zoom` for the track player, `transform` for the gutter one (2026-08-24)

**Decision:** From 640px up a track player is drawn at half size — painted 20rem × ~89px against the 175px it takes on its own — using `zoom: 0.5` on a source that is 40rem wide. Phones keep the player exactly as it was.

**The two players shrink by different properties, and the reason is flow.** The gutter album player is `position: fixed`, so `transform: scale()` costs it nothing — nothing is laid out around it (#97). A track player is IN FLOW inside a paragraph, and a transform there shrinks the picture while leaving the full-size hole behind it: the writing would close up around a 175px gap containing an 89px player. `zoom` scales layout as well as paint, so the text closes up around what it can actually see, with no negative margins to keep in sync. **Neither property is the general answer; the question is whether anything is laid out against the thing being shrunk.**

**The source had to be doubled before it could be halved.** Scaling halves both axes, so a 20rem player at `zoom: 0.5` would have been 10rem wide — half the width that was deliberately chosen one entry ago. Setting the source to 40rem lands the painted width back on 20rem while the height halves. It also hands Apple a comfortable 640px to lay out in, well past the ~300px its compact form wants, so nothing inside is squeezed. The margin is doubled to 3rem for the same reason — `zoom` shrinks that too, and 3rem is what leaves the 1.5rem every other block has.

**Phones are excluded deliberately, not by omission.** There the column is already narrow, the player is the only thing in it, and half of Apple's type at that size is not a control anyone can use. The rule sits inside `@media (min-width: 640px)` and a phone measures `zoom: 1`, full column width, full 177px height, 1.5rem margins — unchanged.

**Apple's embed came back during this pass, so the last three entries' visual claims are now confirmed rather than inferred.** The gutter player renders dark with its **Play button present** (#96's revert was right), `theme=auto` produces genuinely dark players on a dark page and light on a light one (#97), and the half-size track player shows artwork, title, Play, the Apple Music link and the data line — everything, just smaller.

**Hiding the artwork inside a player is not possible and should not be attempted.** The embed is a cross-origin iframe: its internals cannot be styled, and Apple exposes no parameter for layout — only `theme`, the track id, language and an affiliate token. The one mechanical route is cropping the artwork column away inside an `overflow: hidden` wrapper, which cuts a fixed rectangle out of a layout Apple can change at any time and would break silently when they do. A player without artwork means a custom player, which means MusicKit JS, a paid developer account and a runtime token — the three things this site is built not to have (#92).

## 99. The track player is shorter, not smaller (2026-08-24)

**Decision:** #98 is reverted — a track player takes the column at full width again, with no `zoom`, no `max-width`, no doubled source and no margin compensation, and #97's `max-width: 20rem` goes with it. What it keeps instead is a shorter compact player: **150px rather than 175px**. The album player's gutter breakpoint stays at 1400px.

**Reverted, not tuned.** Two passes narrowed the track player and then halved its height, and the result was a control drawn at half of Apple's type in the middle of an article. The player is the one thing on the page a reader might actually operate, and making it the smallest thing there had it backwards. Compact vertically is a different ask from small, and it has a different answer: keep the width, take the height.

**150px is a measured floor, not a guess, and that distinction is the whole point.** The player does not reflow to the height it is given — it lays out and is clipped (#93) — so the only safe number is one that was looked at. At 150px every part is still there: artwork, title, the overflow menu, Play, the Apple Music link and Apple's data-disclosure line. At 130px that disclosure line goes, and at 110px the Play button is cut in half. So 150 is where it stops: 14% shorter and nothing lost. **130 is available and deliberately not taken** — the line it removes is a data-handling disclosure, which is not ours to trim for 20px.

**`data-kind` and `theme=auto` both stay.** `data-kind` is placement (album to the gutter, song beside its sentence, #94) and was never about size. `theme=auto` (#97) is about matching the page's theme. Neither was part of what went wrong.

**The gutter breakpoint stays at 1400px.** Lowering it to 1280 to match the contents rail was tried in this same pass and reverted. It would have saved 450px of page on every window between the two — the article measured 719px instead of ~1169px at 1280 — and it is a one-line change if that trade ever looks worth it. The reason it is not taken now: the player's LAYOUT box is still 320px wide even though it paints at 213px (a transform shrinks paint, not layout), so at 1280 the box hangs past the window and the arrangement only works because `position: fixed` keeps it out of `scrollWidth`. That is true, and verified, and still a thing standing closer to the edge than it needs to.

## 100. Apple's chrome is cropped off the players (2026-08-24)

**Decision:** Every Apple Music player is clipped by `--am-crop-top: 34px` and a per-player `--am-crop-bottom` (14px song / 22px wide album / 50px narrow album), removing the Apple Music wordmark and Sign In row from the top and the "See how your data is managed" line from the bottom. 56px off each player, at all three mount points: the markdown blocks, the section page's playlist, and the phone sheet.

**Requested after being advised against, which is why this entry is long.** The recommendation was to leave all three alone, with three reasons given: it reaches inside an iframe we do not control, Apple's Embedded Content terms require the player to be displayed unaltered and unobscured, and the data line is a privacy disclosure — Apple telling the READER how the embedded player handles their data, which is the one of the three that is not ours to remove for pixels. Kyrylo chose to crop both. It is his site and his call with Apple, and the reasons are recorded here rather than argued again.

**The mechanism is robust; the numbers are not, and that distinction is the whole risk.** Pulling the iframe up by a negative margin under `overflow: hidden` shrinks its parent's content box by the same amount, so ONE pair of values crops a 150px song player and a 450px album player identically — 56px off each, verified — with neither height named in the CSS. What cannot be made robust is 34 and 22: they were measured against Apple's layout as it is today, and Apple can change their padding whenever they like. When that happens this starts slicing the title or the Play button on a live page, and nothing in the build will fail. **If a player ever looks wrong, these two variables are the first thing to check; setting both to 0 restores the untouched player.**

**It compounds with everything else that has a number.** The gutter player's painted height is now two removes from the iframe's own 450px — minus 56 for the crop, then × 0.6667 for the scale (#97) — so `--gutter-player-h` is 264px. Anything else positioned against a player has to be told the same story.

**`.am-crop` carries the radius as well as the clip.** Cropping the top removes the rounded corners Apple draws on their own card, so the wrapper supplies `--r-lg` in their place; without it the players end in square corners against a page where nothing else does.

**The TOP crop is two numbers too.** A song player's header band is shorter than an album's, so the album's 34px took the wordmark AND the padding above the artwork, leaving it flush against the card's edge. The song takes **24px**; the album keeps 34px.

**The bottom crop is THREE numbers, because Apple has three bottoms.** One value was wrong within a day of shipping, in both directions at once:

- **Song player: 14px.** Apple leaves about 24px under its buttons, of which ~10px is padding. The album's 22px took the disclosure line AND the breathing room, and the controls ended up against the card's edge.
- **Album or playlist, wide: 22px.** Its bottom band is genuinely bigger — at 14px the disclosure line peeks back in at the bottom right.
- **Album or playlist, narrow: 50px.** See below.

**"View in Apple Music" can only be cropped in one of the album player's two layouts, and that is a property of Apple's design, not a setting.** Wide — inline in the writing, and on the section page — the player is TWO COLUMNS: the track list on the right ends with that link sitting level with the Play button on the left, so cropping the link takes the Play button with it. Narrow — the gutter player and the phone sheet — it stacks, the link sits BELOW Play, and it can be taken on its own. So the 50px applies to exactly those two places and the wide ones keep 22px. **If the wide player ever loses its Play button, someone has applied the narrow number to it.**

**Apple's layout switch was MEASURED, and that is what makes the phone rule safe.** The section page's playlist is two-column on a desktop and stacked on a phone, so its crop has to follow the window — and picking the site's usual 640px phone breakpoint would have been wrong, because at 639px the column is still 591px and firmly two-column, which is precisely the case that cuts the Play button. Loading the embed directly and narrowing it puts the switch between **450px (stacked) and 480px (two-column)**. The rule fires at a 480px WINDOW, where the column is 432px — inside the stacked range with room — and that covers every phone in portrait. Above it the playlist keeps the wide crop and its link, which is the failure that costs nothing.

**Revisit when:** a player looks clipped in the wrong place. That is the failure mode this trades for the 56px, and it will present as a cut-off title or a half Play button rather than as an error.

## 101. The bottom crop broke playback, and cannot exist (2026-08-24)

**Decision:** `--am-crop-bottom` is 0 everywhere and stays there. The top crop (#100) remains: 24px on a song player, 34px on an album or playlist.

**Apple's player has a PLAYING STATE, and every measurement behind #100 was taken while it was idle.** Press Play and the bottom band stops being the "View in Apple Music" link and the disclosure line and becomes a progress bar and the transport controls — previous, pause, next — which run to the iframe's last pixel. So the crop that tidied the idle player sliced the controls in half the moment anyone actually used it, on desktop and phone alike. It shipped that way and Kyrylo found it in minutes.

**There is no number that satisfies both states.** They are the same band used for different things: hide the link while idle and you have taken the controls while playing. The choice is the disclosure line and the "View in Apple Music" link, or working playback controls, and that is not a close call — the player exists to be played.

**The three bottom values that were carefully derived — 14px, 22px, 50px — were all wrong for the same reason**, and the care taken over them is the point. They were measured, split per player type, split again per layout, and checked at 1:1 in four places. None of that could help, because the flaw was not in the arithmetic: an entire STATE of the thing being cropped had never been looked at. **Measuring a component only tells you about the state you measured it in.**

**The top crop survives because the header does not move.** The Apple Music wordmark and Sign In row sit above the content whether the player is idle or playing, so removing them takes nothing in either state. That is the difference, and it is why the whole crop did not have to be abandoned.

**The one gain: the numbers stop compounding.** `--gutter-player-h` was 300px, then 264px when the crop landed; it is 277px now — the iframe's 450px less the 34px top crop, times the 0.6667 scale. Every entry that touches a player's size has had to restate this figure. It is stated in one place and derived nowhere else.

**Revisit when:** never, unless Apple gives the embed a parameter for its own chrome. The next person to reach for `--am-crop-bottom` should press Play first.

## 102. What can be cropped, measured from Apple's own DOM (2026-08-24)

**Decision:** The bottom crop comes back, sized to the disclosure line and nothing further: **16px on a song player, 18px on an album or playlist**. "View in Apple Music" stays. The values are read off Apple's layout rather than estimated.

**The rule that came out of it: `a.legal-link` is always the bottom-most thing Apple renders.** Song or album, wide or stacked, idle or playing — nothing is ever placed under it. So a crop that stops at the top of that link is safe in every state, and #101's "the bottom cannot be cropped at all" was too strong a conclusion drawn from one broken case.

**What #101 actually got wrong was the SIZE, not the idea.** The 50px that hid "View in Apple Music" reached past the link and into the band the transport controls take over during playback. The link and the controls share that space; the disclosure line does not.

**Measured properly this time, by driving the player instead of looking at it.** The embed was loaded top-level (where its Play button can be clicked, unlike the `credentialless` iframe on the site), started via `button.play-initial`, then walked through its shadow roots — the player's markup is entirely inside them, which is why an ordinary `querySelectorAll` finds only `<html>` and `<body>`. Both states, all three sizes:

```
song  (576 × 150): link top 134, controls end 129  →  crop 16, 5px clear
album (576 × 450): link top 432, controls end 416  →  crop 18, 16px clear
album (336 × 450): link top 432, controls end 423  →  crop 18, 9px clear
```

**The song player is identical in both states** — it puts the progress bar and the play button on one row and never reaches for the bottom band, which is why the earlier 14px felt fine even though nobody had pressed Play on it. Only the album's controls move, and even then they stop above the link.

**The estimates that came before were both ~1px into the controls.** Reading a screenshot gave 20px and 26px; the DOM gives 16px and 18px. Everything up to here would have looked correct in a screenshot and clipped the edge of a control in use, which is the same failure as #101 in miniature. **Numbers about someone else's layout should be read out of that layout, not off a picture of it.**

**Revisit when:** the disclosure line moves, which would be the first time Apple has put anything beneath it. The probe is worth re-running rather than re-derived: load the embed top-level, click `button.play-initial`, walk the shadow roots for `a.legal-link`, and take the window height minus its `top`.

## 103. The music page is a list of artists, not a list of notes (2026-08-24)

**Decision:** `/music` groups its notes under the artist they name. One card per artist, ordered by whichever has the newest note, tinted with that artist's most recent cover. Each card opens with a portrait, the artist's name and a short description; each row prints what the note is about — `Clancy · Album`, `GASOLINE · Track` — in grey after the title. Grouping and ordering live in `lib/music.ts`.

**A flat list answered the wrong question.** Ordered by date, the section said "what did he write last", which the Posts section already does better and with more of it. What a music page is asked is "what is he listening to", and that question is about ARTISTS with the writing hanging off them. Publishing a note about Twenty One Pilots should move Twenty One Pilots, not just add a row.

**The two biographies are deliberately different texts, and that is the whole shape of the feature.** The artist's description lives ONCE, in the section's `main.md` under `artists:`, and is about the band. A note's own `artist_bio:` is about that RECORD — Clancy's now explains where the album sits in the Dema story, where it used to repeat the band's history. Before this the same paragraph was in the note and would have been in every future note about them, which is how copies drift apart. **`main.md` describes the artist; a note describes a record.**

**The artist list belongs to the section, not to a folder of artist notes.** A `.md` file anywhere under `vault/Music/` becomes an entry with its own URL — that is the vault's central convention — so artists cannot be files without becoming pages nobody asked for. `section.meta` is the documented escape hatch for exactly this, and `playlists:` was already there.

**The tint is the newest cover, so the card repaints itself.** `cover` on a group is `notes.find(n => n.cover)` over a newest-first list, which means adding a Clancy note both moves the card to the top and recolours it, with nothing to maintain. Same mechanism as #90, now once per artist rather than once per page.

**`format:` is inferred before it is required.** A note that embeds an Apple Music link carrying a track id is a Track; anything else is an Album. That covers the two common cases with no frontmatter, and leaves `format:` for what no link can reveal — an EP, a single, a live record. The label is bilingual through `lib/ui-strings.ts` and never written into the title, the same rule as a shelf creator's role.

**The New mark sits with the DATE, not the title, and it is undressed there.** It says when a note arrived, which is the same kind of fact as the date beside it; trailing the title it read as a new *kind of record*, because the grey format label follows there. `NewBadge` ships as a bordered chip — right where it follows a title in a row of text, wrong in a corner that already holds artwork, a format label and a card edge. In this cell it loses the border, the fill, the padding and its own `ml-2`, and takes the date's colour and size: what marks it is the word. Overridden HERE rather than in the component, because the chip is still correct on posts, projects and home, and this is the one place it stands beside a date.

**The rows are indented so their covers sit centred under the portrait, and the indent is derived, not typed.** The covers were already left-aligned with it, which looks like a near-miss rather than an alignment once the portrait is 5rem and a cover is 44px. `--music-row-pad` is `0.5rem + (var(--artist-photo) - var(--music-art)) / 2` — half the difference between the two — so the alignment survives either size changing, and the phone's smaller pair needs no second number. It is also why `--artist-photo` is declared on `.music-card` rather than on `.artist-head`: the rows have to be able to read it. The divider's left edge is computed from the same variable, so it still starts at the text column.

**Nothing falls out of the page.** A note naming no artist joins one trailing group with no card; a note naming an artist `main.md` has never heard of still gets a card and a tint, with only the portrait and description missing. Both degrade the way a shelf creator does rather than vanishing.

**The portrait breaks the card's TOP edge, and that required the card to stop clipping.** `.music-card` was `overflow: hidden`, which is what kept the tint inside its rounded corners — so the wash now rounds its own corners with `border-radius: inherit` and the card is `overflow: visible`. The portrait is 5rem and rises 1.75rem, of which the card's own 0.25rem of padding is spent, leaving 23px genuinely above the card. 4rem and 19px on a phone.

**Through the top rather than the left, which is what let it grow.** It broke the LEFT edge first. Two things were wrong with that: a horizontal overhang eats the page's gutter, so on a phone the portrait crept toward the window and the size had to be capped to keep it off; and sliding out sideways reads as artwork escaping the card rather than as a badge pinned to it. Rising through the top costs no horizontal room at all, so the portrait went from 4rem to 5rem in the same layout.

**Its cost is vertical, and it has to be paid.** A portrait 23px above the card lands on whatever is above it — at the old 1rem gap it sat on the previous card, and under the heading it sat on "Notes on what I'm hearing". The stacking gap is 2.5rem and the first card's is 2.25rem; measured after, the second card's portrait clears the one above by 17px and the first clears the heading by 13px.

**It is positioned ABSOLUTELY, and that is not a detail.** As a flex child a negative margin drags the name and bio with it, and every attempt to push the text back moved the portrait back by exactly the same amount — the overhang and the text column cannot be separated while they share a flow. Out of flow, they are independent numbers.

**A shadow, not a ring.** Half the circle sits over the card and half over the page, so a ring would have to be two different colours to look right in both places. A shadow is correct in both.

**An artist links to their People note when one exists.** The portrait and the name become links; the BIO never does — it is a paragraph, and a paragraph-sized target that navigates is a trap for anyone trying to select it. Matching is by title in either language, file name, slug or `aliases:` — the same set `getWikiIndex()` uses — so a music note linking "Måneskin" finds a profile filed under any of its spellings. **Nothing appears when there is no profile**, which is the normal case and must not look like a broken control.

**That link is covered by `npm test`, because the vault cannot exercise it.** No People note is about a musician today, so the path renders nowhere — exactly the kind of thing a reader finds broken rather than a build. `buildPersonIndex()` takes its entries rather than reading them, so it is testable without touching disk; it was also checked end to end by temporarily aliasing an existing People note, watching both links appear, and removing the alias again. The same reasoning covers `format:`, where the vault only ever exercises the inferred branch.

**Måneskin was added as a second artist** so the grouping is exercised by the vault and not only by a test: one artist proves nothing about ordering. Its GASOLINE note carries the band's photo (Wikimedia Commons, Paolo Santambrogio, **CC BY-SA 4.0** — attribution required and recorded in the frontmatter) and RUSH!'s cover from the same keyless iTunes lookup as everything else. The note's body is factual only; the "Why it's here" section is a heading and a comment, because the opinion in it is Kyrylo's to write.

---

## 104. On fifteen days a year the counter names the day (2026-08-24)

**The sidebar's "Day N of Ukraine's resistance" steps aside on Ukrainian national days** and names the day instead. Eight CELEBRATIONS — Unity, Vyshyvanka, Constitution, Flag, Independence, Defenders, Dignity and Freedom, Armed Forces — and seven days of REMEMBRANCE: the Heavenly Hundred (20 Feb, which is also day 1 of the count), the full-scale invasion (24 Feb), Chornobyl, Remembrance and Victory over Nazism, the Day of Mourning, Ukraine's fallen defenders (29 Aug) and the Holodomor. Dates and kinds in `lib/observances.ts`, words in `observanceName` in `lib/ui-strings.ts`, both treatments at the foot of `globals.css`. Every other day it counts, exactly as before.

**A running total is the wrong sentence on Independence Day.** The counter is a statement about endurance, and it is the right one 357 days a year. On the day the country celebrates itself, "Day 4569" answers a question nobody asked — it measures the war where the day is about the state. Replacing the line rather than adding one keeps the sidebar's shape: still one quiet line at the foot, still the donation link, still no call to action.

**Two kinds, and the flag belongs to only one of them.** A `celebration` takes blue over yellow. A `remembrance` never does — it goes monochrome at `--text-secondary`, no gradient and no fade. Mourning is not celebrated in the national colours, and a memorial painted in them reads as a poster for the state rather than a note about the dead. The site already has a register for grave emphasis and it is the absence of colour (#64): on a page with nothing else coloured, text weight IS the emphasis, so the remembrance line is just the ordinary one standing up straighter. `--text-secondary` rather than the full `--text`, which at 11px in an otherwise grey corner would make a memorial the loudest thing in the drawer.

**`kind` on the row is the only thing that decides it.** Adding a day is one line in `DAYS` and one string pair; nothing in the component or the CSS learns a new name. The first cut of this shipped celebrations only — the argument for excluding memorials was that the counter already carries that weight — and adding them was a table edit rather than a rewrite precisely because the treatment hangs off `kind`.

**These are not the flag's own hex values, and that is the point.** `#FFD700` on white is barely a mark at 11px, and `#0057B7` on a near-black page is a hole rather than a colour — so light mode takes a deeper gold (`#a67c00`) and dark mode the true yellow with a lifted blue (`#5b9bea`). What survives in both is the flag's RELATIONSHIP — blue over yellow, both legible — which is the part that means anything. Two tokens, `--ua-blue` / `--ua-yellow`, used by one line on eight days.

**This is not an accent colour and must not become one.** #64 deleted `--accent` after four passes, and it stands. This is closer to the callouts' four hues: colour that carries meaning, in one place, where the meaning IS the colour.

**Blue over yellow inside one glyph, with a hard edge.** A two-stop gradient (`0 62%`, then `62% 100%` — not `blue, yellow`) clipped to the text. A flag is two bands meeting at an edge; a fade would read as a gradient effect, which is a different and much worse idea.

**`line-height: 1` on an inline-block is load-bearing, and 62% is measured.** The gradient is sized against the element's box, and an inline box is as tall as its line-height — at the paragraph's 1.5 the seam falls below the letters and the whole line paints blue. Tight to the text, the box is exactly one font-size tall, and Source Serif 4's baseline and x-height put the middle of a lowercase letter at 62% of it. So lowercase gets one clean band each way, capitals and ascenders run blue, descenders run yellow. It's a ratio, so it holds at any size. 50% reads almost entirely yellow and 68% almost entirely blue; both were looked at before 62% was picked.

**Then held back to 0.7, so it greys.** Two saturated colours at full strength in the quietest corner of the page pulled harder than anything else in the sidebar, which is backwards — the line is a note at the foot of the drawer, not a banner. Opacity rather than duller tokens: blending toward the page mutes the colour in BOTH themes at once, so neither palette had to be re-tuned and the flag survives the fade. It lands at roughly the weight of the `--text-tertiary` counter it replaces, which is the target. 0.55 was too far — the gold half all but vanishes on white.

**One line in both languages is a hard constraint, and it chose the wording.** The sidebar gives 176px at 11px. Measured in the browser, the widest of the sixteen strings is `День захисників і захисниць` at 154px — which is why the fuller official title (`День захисників і захисниць України`) isn't used. The existing Ukrainian counter is 188px and already spills into the padding; nothing here does.

**Re-checked in the browser like the count, and for the same reason.** The site is fully static, so the build-time answer is baked in — a deploy from the 23rd would still be saying Flag Day on the 24th. `ResistanceDay` takes both as `initial` props (so the static HTML is right for crawlers and hydration has nothing to disagree about) and re-reads both from `new Date()` in one effect.

**Two dates move with the calendar**, so they can't be table rows: Vyshyvanka Day is the third Thursday of May and Holodomor Remembrance Day the fourth Saturday of November. One `nthWeekday()` places both. November is the reason it has to be right — Holodomor lands between the 22nd and 28th, and Dignity and Freedom Day is the 21st, so an off-by-one week would silently print the wrong day.

**Covered by `npm test`, because the vault can't exercise it.** Fifteen days of the year render this and the other 350 don't, so nothing but a test sees the branch until the morning it ships broken. `lib/observances.test.ts` pins every fixed date, checks a day number can't match in the wrong month, asserts the two moving dates land on the right weekday inside the right week across five years (and that Holodomor never collides with the 21st), and asserts that no day of mourning is classed as a celebration — which is the one mistake here that would actually matter.

**It reads the READER'S local calendar date**, the same components `resistanceDay()` already reads — not Kyiv time. A visitor in Ontario sees Independence Day on their own 24 August, which is the day they'd think of it.


## 104. The gutter player was not moving — the viewport was (2026-08-24)

**Decision:** A page carrying the gutter album player sets `overscroll-behavior-y: none`, scoped to that page and to the width where the player exists. The artist cards' internal spacing is tightened.

**It looked like a positioning bug and was not one.** The player drifts "for a bit" when a scroll reaches the top or the bottom. The obvious suspects were both checked and both cleared: it computes as `position: fixed`, and NO ancestor carries a `transform`, `filter`, `perspective`, `will-change` or `contain` — any of which would have made an ancestor its containing block and left it scrolling with the page. What moves it is the browser's elastic overscroll: past either end the compositor bounces the WHOLE viewport, fixed layers included, and settles back. **A fixed element cannot opt out of that.** The only lever is the bounce, which is why the fix is on `html` and not on the player.

**Scoped to the problem, because the property has a cost.** `overscroll-behavior: none` on the root would also disable a phone's pull-to-refresh, and it removes the elastic feel everywhere. The rule sits inside the 1400px block and behind `html:has(.music-note .apple-music-block[data-kind="album"])`, so it applies only where the player is and only at a width no phone reaches. **Widening it to bare `html` would also steady the contents rail, the floating breadcrumb and the reading-position pill**, which bounce for exactly the same reason — that is a one-line change if the elastic scroll is ever judged to cost more than it gives.

**The cards got tighter.** Head padding went from `0.875/1rem` to `0.625/0.5rem` and the rows from `0.5rem` to `0.375/0.4375rem`, with the bio's lead-in trimmed too. The card is a list with a header, not a panel, and the risen portrait already gives the top plenty of weight. The portrait still clears the first row by 77px, so nothing was traded for the space.

**The middot between New and the date is a pseudo on the DATE, not an element between them.** `NewBadge` renders nothing at all when a note isn't new, so a separator written into the markup would strand itself in front of every older row. `.music-meta > span + .music-date::before` can only match when the badge is genuinely there — including after it mounts on the client, since the badge is client-only. Measured on the two live rows: the new one reads `New · August 24, 2026`, the older one `July 17, 2026` with the pseudo computing to `none`.

**The head's padding is asymmetric on purpose.** Top stays tight; the BOTTOM went back up to 1rem, because it is the only thing separating the artist's description from the notes — two different kinds of text that need a visible seam. 16px between the bio and the first row.

**A measuring note, recorded because it cost time twice:** the portraits read as `naturalWidth: 0` and rendered as alt text through several checks. Neither was real — once because the dev server had died and the page was a stale render, and once because `loading="lazy"` had simply not fired yet at the moment of measurement. A fresh `new Image()` against the same URL returned 256, and `curl` returned 200 with the right byte count. **When an image looks broken, check the server and the lazy state before the markup.**


## 105. The format label must not share the title's ellipsis (2026-08-24)

**Decision:** A row's title and its format label are a FLEX PAIR inside one grid cell — the title shrinks and ellipsises, the label never does. On phones the New mark is dropped, and the portrait and covers move 4px closer to the card's left edge.

**The label was inside the title's span, so it inherited the truncation.** On a phone the row read `GASOLINE · Tr…`: the label was being cut, and the ellipsis drew in the TITLE's colour, so grey text ended in white dots. Splitting them means the title is the part that gives way — which is the right order, because the title is repeated on the row's own page and the label appears nowhere else.

**`min-width: 0` on the flex wrapper is the load-bearing line.** Without it a flex item refuses to shrink below its content width, so the title would push the label out of the row instead of ellipsising. That one declaration is the difference between the pair working and the pair being worse than what it replaced.

**Track beats New when the row runs out of width.** The date and the label each say something nothing else on the row says; "New" repeats what the date already tells a reader who can see it. So it is the part that goes below 480px, where it and its separator are ~46px of a 301px row. Its middot goes with it — the separator is a pseudo on the date and is hidden by the same rule, so nothing is left stranded.

**A self-inflicted bug worth recording:** renaming the grid AREA to `meta` while `.music-meta` still declared `grid-area: date` left the cell with no area to occupy. It was auto-placed, the columns collapsed, and the title measured **0px wide** — the whole row looked rearranged. Grid areas are matched by NAME in two places, and changing one is a two-file edit even when both are in the same file.

**Still true on a 375px phone: "GASOLINE" itself truncates by ~28px.** The label and the date are both whole and the ellipsis now matches the text it cuts, so this is a graceful failure rather than the broken one. The clean fix, if it ever matters, is to move the date onto the description's line on phones — `"art head head" / "art desc meta"` — which hands the whole first line to the title. Not taken because it moves the layout more than the problem warrants.

## 106. A shared link is a card from the vault (2026-08-25)

**Decision:** Every Open Graph route uses one editorial vault-card system in `lib/og.tsx`: Source Serif 4, the favicon's double-chevron in monochrome, an inset hairline with two short horizontal registration ticks, a deterministic dot fingerprint made from the title, and either an oversized ghosted mark or mounted artwork. Cover art is the only colour.

**The old cards belonged to a starter, not to this site.** They were a black rectangle, one white bar and a generic sans-serif title. Shelf and Music cards added useful artwork, but the text half still looked like a presentation template. A shared link is often the first view of the site somebody gets, so it should carry the same editorial voice as the page it opens: the same serif, the same monochrome discipline, and the same mark as the favicon.

**One renderer is the identity.** Root, section and entry routes already called `ogImage()`, so the redesign stays there rather than giving each route its own composition. Text-only pages use the large mark as their image; Shelf and Music replace that visual weight with the thing the note is about. People remain text-only — a person's portrait is not a cover to paste onto a social card — and an undecodable or missing cover still falls back without failing the build.

**The title makes its own fingerprint.** Twenty dots take bits from a stable hash of the title, with the first and last held on so even a sparse result has an edge. That makes cards visibly related but not duplicated, and does it without assigning colours to sections, generating decorative images, storing another frontmatter field, or changing when the title changes. It is identity at the scale of a feed, not data anyone has to decode.

**Artwork is mounted, not used as a palette.** The offset plate lets a cover feel like an object placed in the card while keeping the frame monochrome. Tall, wide and square mounts preserve the recognisable silhouette of a book, video or record. The image uses `object-fit: contain`: an actual jacket can be narrower or wider than the nominal mount, and cropping its edge in order to make the box perfectly full was the wrong trade. The old renderer used `cover` while claiming nothing was cropped; this makes the claim true.

**The serif is embedded separately because `next/og` is not the page.** The live site registers Source Serif through `next/font`, but Satori renders an image from JSX and needs the font bytes in its own `ImageResponse` options. Static regular and bold TTFs therefore live under `assets/fonts/` with Adobe's OFL and provenance. They are build inputs only; the page continues to use the existing variable Cyrillic font and optical-size axis. This is deliberate duplication at an integration boundary, not a second type system.

**The mark is redrawn from `app/icon.svg`, not imported as an image.** Inline paths render reliably in Satori, can be scaled from the small masthead to the oversized background without another asset read, and stay monochrome. The standalone favicon uses one neutral `#71717a` fill: dark enough for light tab chrome, light enough for dark tab chrome, and no longer an accent on a site that deliberately has none. If the favicon's geometry changes, both copies must change together.

**Checked as a family, because no one card proves the system.** The browser matrix includes root, section, plain article, People, tall Shelf, wide video, square Music, and the longest current cover title. All are 1200×630; the long titles hold their hierarchy, the three artwork shapes remain whole, and the plain fallback still looks intentional.

**Revisit when:** the favicon mark changes, a fourth kind of artwork needs a genuinely different silhouette, or a title longer than the current responsive thresholds can hold. Do not introduce section accent colours to solve any of those — the art already has colour, and the text-only card's fingerprint is its variation.

## 107. The gutters' breakpoint is derived, not borrowed (2026-08-25)

**Decision:** the width at which the article grows its two margins — the contents rail on the right, sidenotes and pull-quotes on the left, and `.resume-reading` dropping under the rail's column — moves from **1280px to 1168px**. Five media queries in `globals.css`, one number, still shared between all of them.

**1280 was Tailwind's `xl`, not a measurement.** The rail's geometry decides when it fits: the page is a centred `--measure` (39rem, so 19.5rem either side of centre), the rail starts 2.5rem past the text and is 13rem wide, so its outer edge lands 35rem from centre. Add a `--gutter` (1.5rem) of air off the window and the rail has room from 36.5rem of half-width — **73rem, or 1168px**. At 1280 there were 80px of empty margin left over at the breakpoint itself, and every window between 1168 and 1280 lost the rail to the floating pill while the rail still fitted. That's the whole bug: a laptop window that isn't maximised reads as a phone.

**1120px is the floor and is not taken.** That's where the rail's edge touches the window with zero margin. 1168 keeps the rail exactly as far from the window edge as the text is from the edge of its own box, which is the only value here that isn't arbitrary. Measured in the browser rather than reasoned about: at 1168 the rail sits 24px off the edge and the sidenote column starts 64px in, well clear of the 16px `.edge-zone`.

**All four things move together, deliberately.** The left gutter only needs 65rem and could have arrived earlier, but a page with sidenotes and no contents rail (or the reverse) is lopsided — the comment on `.sidenote` has always said the two appear at the same width, and this keeps that true. `.resume-reading` has to move with the rail for the same reason it did before: from the width where the rail exists, the pill belongs at the foot of that column instead of out at the window's edge.

**The music gutter player stays at 1400px** (#99). Its layout box is 320px wide even though it paints at 213, so it needs the room the rail doesn't; moving the rail down only widens the gap between the two breakpoints, and does not reopen that question.

**Revisit when:** `--measure`, the rail's 13rem width or the 2.5rem gutter changes — the number is that arithmetic and has to be re-derived, not nudged.

## 108. The contents control has one shape, not three (2026-08-25)

**Decision:** the floating contents pill is the three-line icon in the **top-right corner at every width below the rail**. The labelled chip that sat at the bottom-left between 640px and the rail's breakpoint is deleted, along with `.toc-bar-label`, the `LABEL_CHARS` cap and `truncateLabel()` in `components/Toc.tsx`. Two presentations remain: the rail from 1168px (#107), and this icon below it.

**Three shapes for one control is two too many.** #51 moved the phone version to the top-right and explicitly left everything above 640px alone, which was the cautious call at the time and left the site with a control that changed corner, shape and contents on the way down: a labelled bottom-left chip on a laptop, a bare top-right icon on a phone. Nobody resizes a window slowly enough to see that as a transition; they see two different features. The icon is now the same object from a 320px phone to the width where the rail takes over.

**The top-right is the right corner to keep.** It pairs with the floating breadcrumb bar opposite it — same 2.5rem square, same chip material — so the top of the window reads as one family, which is exactly what #51 argued for the album pill too (`.music-pill` steps left when both are present, and still does). It also leaves the bottom of the screen to `.resume-reading`, `.time-left` and a thumb.

**The label is not lost, it is demoted.** "Where you are" survives as the button's `title` — the tooltip a pointer can still ask for — and the sheet's own first row says it again to anyone who opens it. Nothing was printed on screen that the sheet doesn't now say.

**The sheet keeps the phone's numbers as its only numbers:** 13.5rem wide, 55vh tall, hanging under the icon. 13.5rem is the rail's 13rem plus the sheet's padding, so the outline is the same width whether it is a rail or a sheet, and rows ellipsise in both. The old 18rem/70vh variant went with the bottom-left chip.

**A whole ordering hazard went with it.** This section used to end in a `max-width: 639px` block written LAST on purpose, because a media query adds no specificity and only position could make it win (#52). With one presentation there is nothing to override, so that block is gone rather than rewritten.

**Revisit when:** the outline needs to be readable without opening it. That is the one thing the label did, and a rail — not a wider pill — is the answer the site already has.

## 109. The shelf's video queue is a YouTube playlist, not watch history (2026-08-25)

**Decision:** videos reach the shelf through a public YouTube playlist called `Shelf`, read as an Atom feed by `scripts/youtube-shelf.mjs` and turned into notes by a scheduled cloud task following `docs/YOUTUBE-SHELF.md`.

**Watch history was the obvious input and it does not exist.** Google removed watch-history and watch-later from the YouTube Data API in 2016; Takeout still exports history, by hand, which is not something a nightly job can use. A playlist is the substitute and is two taps in the app.

**It is also the better signal.** History records everything clicked and abandoned. The shelf is a judgment about what was worth keeping, and saving to a playlist is that judgment being made at the moment it is felt, on a phone, without opening Obsidian.

**Keyless, which is why it fits.** The playlist feed, oEmbed and the channel page's `og:image` need no API key, no OAuth and no Google Cloud project — the same footing as the iTunes lookup behind music covers (#90) and the channel-avatar cascade already documented for creator photos (#86). A key would have been the first secret this repo ever had to hold.

**The playlist IS the queue, and nothing else records state.** No skip list, no seen-file, no database. A video in the playlist with no note is pending on every run; removing it from the playlist is how you decline it. The alternative — a committed list of refused video ids — is a second source of truth that would drift from the playlist the first time he tidied it on his phone.

**The script writes no notes.** It fetches, parses, diffs and downloads; the agent writes the note. A shelf note needs a translated title, two descriptions, categories and a verified channel bio, none of which is string formatting. The split keeps the deterministic half testable without a network and without a model, which is what `scripts/youtube-shelf.test.mjs` covers — including a pin against `lib/youtube.ts`'s video-ID regex, since a plain `node scripts/…mjs` run cannot import the TypeScript module (the same mirror-and-pin as `MAX_INLINE_SVG`).

**`uploaded:` is the quiet win.** #41 left the key explicit and unfilled because nothing on the site could derive a video's publish date without the Data API — so every video note described itself as a `CreativeWork` and Search Console asked for `uploadDate` forever. The playlist feed carries it. All four existing video notes were backfilled when this shipped, and their fact tables now print a date instead of an em dash.

**The opinion is never written, and the placeholder says so out loud.** The task publishes facts, a cover, a creator block and both languages; the verdict is left to Kyrylo, because a cron that writes his opinions is the failure mode this whole feature has to avoid. The section is `## Review` and its body is the literal `*To be written.*` — which replaced an empty heading carrying an HTML comment. That comment was invisible on the page, so every unreviewed note rendered a heading with nothing under it, reading as a bug rather than as a promise. The heading was renamed across the whole shelf in the same change, including the four notes that already had real reviews, so the section has one name everywhere.

**Branch → PR → merge, never a push to `main`.** Obsidian Git commits and pushes this checkout every 10 minutes. A cloud task pushing to the same branch races it and leaves a conflict on the laptop, which is the one cost the owner would actually feel. A **server-side merge on GitHub is a different act**: `main` moves without anyone pushing to it, and the laptop's `pullBeforePush` absorbs the change on its next sync. That distinction is what lets the task merge its own PR — which it does, by the owner's choice, so a saved video is on the shelf by morning with no step from him. The PR is kept as the record and survives as the run's report; a bad note is one `git revert` from gone.

**Revisit when:** the playlist stops being the only queue — a second one for "watched, not shelved", or per-language playlists. The script already takes a playlist id as an argument for exactly that.

## 110. The book shelf is spines, and a real one beats a drawn one (2026-08-25)

**Decision:** the **section page** (`/shelf`) renders its books row as standing **spines** on one hairline — `components/lists/BookSpines.tsx`, maths in `lib/spine.ts` — while `/shelf/type/books` and its category pages show the covers full size in a grid. A note with `spine: <file>` shows a **photograph of the actual spine**; every other book gets one generated from its cover's dominant colour. The other three mediums keep their Netflix strips on the section page.

**The two pages were the same page twice.** The section page showed eleven books as 2:3 cards in a scrolling strip; `/shelf/type/book` showed the same eleven as the same cards in a three-column grid. Two pages, one grammar, and the second added nothing but size. This is the /music method applied to books (#103): borrow the grammar the medium owns. For music that was Apple Music's track list; for a book it is a bookcase, which is older than any app and needs no explaining.

**Which page gets the bookcase was decided the wrong way round first, and the flip is worth recording.** It shipped with spines on the MEDIUM page and covers on the section row, under the slogan *rows are faces, the shelf is spines*. That is a tidy sentence and the wrong allocation, because it ignores what each page is for. `/shelf` is a **glance at everything** — four mediums sharing one screen — and a shelf answers that in a fraction of the room a cover strip needs: eleven books in about 500px, no scroller, and it is the only row on the page that looks like the thing the section is named after. `/shelf/type/books` is where the reader has **already chosen books** and wants to look at them, and there the cover art is what a book is actually recognised by. **Compact overview, rich detail.** The first arrangement had it backwards on both counts: it spent a whole page on the compact form and buried the detailed one in a strip you had to drag.

**Nothing is lost at browse level any more**, which was the accepted cost of the first arrangement and is now simply gone: the spines are the summary, the covers are one click behind the heading that was already there.

**A photographed spine is strictly better than a generated one, and it solves the problem the plan gave up on.** The plan rejected spine THICKNESS outright: it would want a page count the vault has not got, and a guessed thickness is a lie about a real object. A photograph is not a guess — it *is* the thickness, so a book with one sets its own width from the image's aspect ratio and stands thinner or fatter than its neighbours for the right reason. Sapiens comes out at 36px against the generated 44px. Height still comes from the COVER's aspect ratio in both cases; the spine photo's ratio carries thickness against height, not height itself, so it cannot answer that question.

**What the photograph replaces, and what it does not.** It replaces the ground and the drawn type — the words are printed on the object, and drawing them again would be a second title over the first. It does not replace the border, the lift, the reading offset, the New dot or the focus ring, all of which are the site's and not the book's. The suppressed text becomes bilingual `sr-only` text, which is then the link's only real name, with `alt=""` on the image so the book is not announced twice.

**The 1px border earns its keep on exactly this book.** Sapiens' spine is cream, a few percent off the light theme's page colour. Without `color-mix(in srgb, var(--text) 12%, transparent)` it would dissolve into the page — which is half of why that rule exists, the other half being to separate two adjacent books.

**Name a spine asset uniquely.** `getAssetIndex()` is a flat vault-wide basename map, so `spine: sapiens.jpg` beside `cover: sapiens.jpg` resolves to whichever the walk indexed last. The file is `sapiens-spine.jpg`. This is a general hazard of adding any second image key to a note, not a quirk of this one.

**Colour comes from the book and does not reopen #64.** For a generated spine, `scripts/dominant-colour.mjs` reads 64 pixels of the cover, drops the near-white and near-black — paper and ink are properties of printing, not of the book, and a flat mean over them returns grey for every jacket — buckets what is left by hue, and averages inside the largest bucket, because averaging the survivors turns a red cover with a blue band into mud. `spineStyle()` then clamps lightness into `0.24–0.74` and caps saturation at `0.8`. The result **does not flip with the theme**: the colour belongs to the book, and the contrast that matters is internal to the spine. That is also why it is not an accent — no colour here is the site's, which is the whole distinction #64 rests on. The ink is measured, not guessed: both candidates are tried against the clamped ground and the higher WCAG contrast wins, because a lightness threshold gets yellows and mid-greens wrong.

**Height is the cover's aspect ratio, never a hash.** `spineHeight()` maps `h / w` from 1.30–1.70 onto 240–288px, clamped. A random or hash-derived height would look identical and mean nothing, which is worse than uniform. Checked against the real eleven: the spread reads as a shelf rather than as noise. **240–288, not the 196–232 the plan specified** — at 44px wide a 200px spine is barely five times its own width, a pamphlet, and it left about 32 characters before the title clipped, which truncated all but three books. At roughly 6.5 : 1 the proportion is a hardback's. The rest ellipsise with the full string in `title`, and the **title shrinks four times more slowly than the byline** so it is the author that gives way.

**One hairline is the whole piece of furniture.** No wood, no ledge, no shadow under a plank: skeuomorphism on a monochrome site, and the books already supply all the colour there is. The line is the `<li>`'s bottom border with the 3px gap as its own right padding, so adjacent slots' borders MEET — on a phone the row wraps and each line needs its own shelf.

**The trap that cost the first pass:** `.book-spine-text` carries `.lang-en`/`.lang-uk`, and the language toggle hides the inactive one with `display: none` two thousand lines earlier in `globals.css`. A bare `.book-spine-text { display: flex }` written at the foot of the file wins on position — no `@layer` — and both languages painted at once, halving every spine's text (#51, #52, #81). The flex now lives on an inner `.book-spine-lines`. Separately, `.press:active` declares `transform` OUTRIGHT, so `.book-spine:active` has to restate the whole transform rather than set a variable, exactly like `.lightbox-arrow`.

**A translated edition is a different photograph, so the spine is bilingual too.** The words are printed on the object, so unlike a cover — where the art is the same book in any language — a Ukrainian edition's spine is genuinely different artwork. It uses the `<name>.uk.<ext>` sibling convention markdown embeds already have for diagrams (`resolveLangVariantUrl()`), so there is no second frontmatter key to write or forget: drop `sapiens-spine.uk.jpg` beside `sapiens-spine.jpg` and it swaps with the toggle. Width comes from the ENGLISH image for both, so the shelf does not reflow when the reader switches; the two scans agree to 0.4% anyway, which `object-fit: cover` absorbs invisibly.

**Bilingual images cannot be lazy, and that is the opposite of #95.** The site's whole bilingual model is "ship both, CSS picks one" — which means the inactive one is `display: none` when the document is parsed, and a lazy image hidden at parse time never enters the viewport observer. It stays unloaded even after the toggle reveals it: switching to Ukrainian showed an empty book, still 36 × 273, still linked, with nothing in it. #95 relies on exactly this behaviour for iframes, where never loading a hidden player is the saving; here the same mechanism is the bug. Spine art is therefore eager, and two 25KB photographs is a cheap answer.

**A latent version of that bug exists in `themedImg()`** (`lib/markdown.ts`), which stamps `loading="lazy"` on both halves of a theme swap and both halves of a language swap. Nothing in the vault reaches it today — every bilingual diagram is a self-theming SVG, and those are inlined as `<svg>` rather than `<img>` — so it is not currently a visible fault. It would bite the first two-file Excalidraw export or bilingual raster embed. Left alone deliberately rather than fixed in passing; the fix is to drop `loading="lazy"` from the swap-aware branches.

**Hovering a spine brings out the book's face.** A spine identifies a book only to someone who already knows it; the cover is what a reader recognises, and it now lives a page away rather than in the same row, so bringing it out under the pointer answers the question the spine raises. It is a child of the spine, so the two lift as one object, and it floats ABOVE the book's head — clear of the shelf, never over it. Covering the spines was the first version and it was the wrong object twice over: at the spine's full height it blotted out three or four books to identify one, so the row you were reading disappeared under the answer to a question about it. Above the shelf and small (6rem), the book stays where it is and the face reads as an annotation on it. Small is the point — this is a "which one is that?" glance, and the full-size covers are one click away on the medium page, which is that page's whole reason for existing. The cost is that a book at the left of the row puts its face over the `Books ›` heading while hovered; that is a transient popover and the site already floats link previews over prose, so it is accepted rather than bought off with permanent margin. Three details are load-bearing: `pointer-events: none`, or a pointer crossing the cover stops hovering the book it belongs to; the z-index lives on `.book-slot` rather than on the spine, because `.stagger > *` is the slot and its `animation: item-in … both` fills forever on `opacity` and `transform`, giving every slot a permanent stacking context that nothing inside can escape (the cover was sliced in half by the next book along, and a z-index on the spine did nothing at all — the same family of bug as #81); and `@media (hover: none)` hides it with `display: none` rather than `opacity: 0`, because a hidden lazy image is never fetched (#95) and no phone should download eleven covers for a gesture it cannot make.

**The reading state was levitating, and a resting lift is always wrong.** `status: reading` first sat the book 14px proud by translating it up, which left a permanent gap with the shelf's own hairline visible underneath — no object does that, and it read as a rendering fault rather than as a book. It is now `scale(1.045)` from `transform-origin: bottom center`: the foot stays on the shelf and the book reads as NEARER, protruding toward the reader, which is what a half-read book on a shelf actually does. The distinction worth keeping is between a transient lift and a resting one — hover still lifts 8px, and that is honest because a hand is on the book for exactly as long as it lasts.

**Books opt out of the shared row height on purpose.** #54 makes every medium row the same height so the shelves line up down the page; a spine is 240–288px against the strips' 190. It is not being dragged to a height that belongs to artwork — it is a different kind of object, with its own hairline under it, and it sits last in `MEDIUM_ORDER` where a taller row reads as the page's closing note rather than an outlier.

**Every drawn line came off, and the furniture with it.** Three went in one direction. The spine BORDER — a 1px `--text` hairline separating adjacent books and keeping a near-white spine off a light page — read as an outline drawn around a real object, worst on the dark spines where a light ring is unmistakable. The cover-derived GROUND under a photograph went too: invisible behind an opaque image except at the rounded corners, where it showed as a few pixels of the wrong colour, pink on cream Sapiens and brown on the black Campbell. And finally the SHELF LINE itself, the `--border` hairline the plan called "the entire piece of furniture" — under a row of photographed books a rule drawn beneath them reads as a rule drawn beneath them, not as a plank. What makes it a shelf is that the books are bottom-aligned; the eye supplies the rest. This is the logical end of "the books supply the colour and the shelf supplies none": the shelf now supplies nothing at all.

**Cropping a spine photo needs the gradient, not a threshold.** Three separate attempts left visible white: a frame-wide bounding box misses an edge strip entirely (one dark pixel anywhere in that column defeats it), and a fixed brightness threshold fails across stock — pure white paper reads 255, but The Little Prince's outermost column already reads 227 because the object's edge lands inside it, while cream Sapiens' interior runs 145–225 and would be cropped away by any threshold strict enough to catch the paper. What works is per-column MEDIAN against the background sampled from the corners, walking in until the median drops 40 below it, then discarding two more pixels for the blended boundary. Verified by re-profiling the output rather than by eye: the outermost column of every re-cropped spine now reads as artwork (Hero 30, Little Prince 91, Sapiens 225 — cream, not paper). Rounded book ends mean the CORNERS stay light on all of them, and that is the book.

**Then there is a second trim, and it is not the same problem.** With every trace of paper gone the dark spines still showed a white line at head and tail — because that line is the BOOK: the top and bottom of a spine catch the light, and on Hero that band ran three rows deep at **+55 over its own face**, which against a near-black page is a white line whatever its provenance. So the second pass measures each book against ITSELF — interior median, then crop rows from each end while they differ by more than 15, capped at 1.5% of the height. Hero lost 4 rows at the head and 1 at the tail, The Little Prince 1 and 2, New Version 1 and 7; afterwards every edge sits within ~11 of its own interior. **It is a script now** (`scripts/import-spine.mjs`, tested), because five books in it had gone wrong on three of them and the failures were all the same shape: a rule that worked on the book in front of me and not on the next one. Writing it general made that concrete — Footprints on the Road is a WHITE spine reading 232 against paper at 255, and every threshold that worked on a black book walks straight through it. Tightening the threshold to suit it then left a +216 white column on Hero's Ukrainian scan, which the verdict — written against the same constant — called fine. **There is no fixed tolerance that serves both.** What works uses no constant at all: a strip is paper while it is CLOSER TO THE BACKGROUND THAN TO THE BOOK'S OWN FACE, both measured from the image. Where paper is found the crop then follows the blend ramp until it flattens, because the transition is four to six pixels in these photographs and a fixed two-pixel bleed left The Little Prince a +146 edge; where none is found nothing is cut, so a book photographed flush to the frame keeps its own lit edge. Columns are cropped BEFORE rows, since a row median sampled across a wide frame holding a narrow spine is mostly paper — New Version collapsed to 2px tall before that ordering was fixed. All eleven books were re-imported through it, and the one remaining flag is The Last Wish's Ukrainian scan, whose white rounded head genuinely is the colour of the page: the script asked, I looked, it is the book. The verdict judges an edge on delta AND absolute value — brighter than its neighbours is not enough, it must also still be paper-coloured. That distinction came from The Order of Time, purple leather with a genuine +30 sheen down both edges, which every earlier rule would have called dirty and cropped into. **The lesson that cost three passes: verify all four edges.** The first verification printed left and right only, which is exactly why a head/tail band shipped twice while the report said the spines were clean.

**Thickness from page count: built, measured, removed.** `spineWidthFromPages()` modelled a book honestly — leaves plus covers, `pages × 0.05mm + 2mm`, scaled by the ratio the spine is drawn at. Six photographed spines gave REAL measurements to check it against, which is the first time this could be tested rather than argued about. It landed within a pixel on the paperbacks (Sapiens 39 vs 38 measured; Sword of Destiny 29 vs 29) and missed the hardbacks badly (The Hero with a Thousand Faces 31 vs 43; The Little Prince 22 vs 31 on 96 pages) — boards and paper stock carry a hardback's thickness and a page count knows nothing about either. The decisive check was internal: the two Witcher volumes are the same imprint and the same format, yet the one with FEWER pages measures THICKER. No formula absorbs that. The code and its tests are gone; the original objection in the plan — a guessed thickness is a lie about a real object — survives the experiment intact. **Do not rebuild it**; this paragraph is the evidence.

**The row's spacing is matched to the first BOOK, not to the row's box.** Every card in the Shows strip is the same height, so its box's top edge and its first card's top are the same line. Books are bottom-aligned and differ in height, so giving the row the same `mt-3` every other row uses left the first book **66px** below the heading against the strips' **18px** — identical by construction and visibly wrong, because the eye reads the book, not the box. `.book-shelf-gap` pulls the row up by the difference, putting the first book exactly where a Shows card would sit; all four rows now measure 18px. The tall books then stand ABOVE the heading, which is the point rather than a cost: the heading's own text is 74px wide and the tall spines are far to its right, so nothing is ever covered — verified, not assumed. Re-derive it by measuring `heading→first item` on both rows if the height range or the shelf's order changes. Not applied below 480px, where the row wraps and pulling a wrapped block up would put its first line through the heading.

**The gap between books is 6px, and the row is nearly full.** 3px was as tight as "books touch on a real shelf" goes, and once the spines grew it read as one solid block rather than eleven objects. At 344–416px tall and 6px apart the row takes **576px of the 624px column** — close enough to the edge that the next enlargement wraps it onto two lines, which would take the shelf's own `.book-shelf-gap` arithmetic with it. Measure the row width before growing them again.

**The uniform width is calibrated against the photographs instead.** A drawn spine is a stand-in for a book we have no picture of, so it should stand in for the ones we do: those measure 25, 29, 31, 36, 38 and 43px, mean 34. `--spine-w` moved from 44px to **34px** (30px on a phone). At 44 every drawn book was fatter than every real one on the same shelf, which made the generated spines read as the odd ones out rather than as the quiet default; at 34 a drawn spine is 7–8.5 times its own width, inside the 6–10 range the real ones actually span. That is the whole of "sizing by page count" that was worth having: one number, measured.

**A photographed width is fractional, and per language.** Rounding it to whole pixels made the box's ratio differ from the artwork's by up to half a pixel, and `object-fit: cover` paid for that out of the image — 9px of the source on The Last Wish, whose wolf medallion sits a few pixels from the foot, so the wolf lost its chin. Leaving the width fractional makes the ratios equal and the crop exactly zero. The same problem appears across languages, harder: two photographs of one book agree to only a few percent, so a single width put a 4% difference through `cover` and cut the Ukrainian medallion outright. Each language carries its own exact width (`--spine-w-uk`), and the cost was that a book's apparent thickness moved about a pixel across the toggle. **That cost is now gone, by removing its cause rather than absorbing it.** The two scans disagreed because they are two photographs; if they are cropped to ONE SHARED BOX they no longer disagree at all. `importPair()` computes each crop independently and intersects them — the tightest box containing no paper in either — takes the deeper of the two head/tail shaves, and encodes both at one size. Every bilingual pair was re-imported that way, and the row measures **349.68px in both languages, 0.000px of movement**, with no image cropped to fit the other. The per-language width rule stays: it costs nothing when the pair matches, and it is what keeps a future unmatched pair correct rather than clipped. Worth noting what the disagreement probably WAS: every Ukrainian scan came out slightly wider relative to its height, all eight leaning the same way, which is systematic rather than random — Ukrainian translations run longer, so those editions may genuinely be thicker books. Sharing a box gives that up deliberately in exchange for a row that does not breathe when the reader switches language.

**All eleven are photographed now, and the generated spine STAYS.** #110 said to revisit once most of the shelf was real: whether the drawn spine should become the fallback rather than the default, and whether the dominant-colour pass still earns its place in `sync-assets.mjs`. The answer to the first is that it already has — no book renders a drawn spine today, so it IS the fallback, and nothing needs changing to make that true. The answer to the second is keep it. The cost is one 8×8 read per image at build time and a hex string in a 23KB manifest; the benefit is that the next book added without a photograph still renders as a book in its own cover's colour rather than as a blank `--surface` slab. Deleting it would make "add a note today, photograph the spine later" a broken-looking state, which is the ordinary way a book will arrive. `lib/spine.test.ts` and `scripts/dominant-colour.test.mjs` are now the only things exercising that path — which is exactly the situation those tests were written for, and the reason not to trust "unused" as a signal here.

**Revisit when:** a book arrives and stays un-photographed long enough to judge the fallback against its neighbours in practice, rather than in a test.