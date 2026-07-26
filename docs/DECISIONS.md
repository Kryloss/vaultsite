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
