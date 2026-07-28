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

**Decision:** Internal links inside `.prose` show an Obsidian-style preview card on hover. `lib/previews.ts` builds an href → {title, excerpt, date, cover} index at build time; the layout passes it to `components/LinkPreview.tsx` as props, exactly like the Cmd+K search index. Excerpts are capped at 180 characters. The feature is pointer-only (`hover: hover and pointer: fine`) and the card is `pointer-events: none`.

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

**Reading position is remembered, and never restored automatically** (`components/ReadingPosition.tsx`). Auto-scrolling is the version of this everyone builds first and everyone regrets — you open a link someone sent you, read two lines, and the page throws you into the middle of a paragraph you don't recognise. It offers, in a pill you can ignore or dismiss, and it hides itself as soon as you start reading anyway.

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
