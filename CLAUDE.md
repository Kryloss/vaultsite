# CLAUDE.md — AI assistant context

Context file for AI models working on this repo. Read this first, then `docs/ARCHITECTURE.md`.

## What this is

Kyrylo's portfolio site, published from an Obsidian vault. The `vault/` folder IS the CMS: folders → section pages, `.md` files → entries with their own URLs. Pipeline: Obsidian Git → GitHub → Vercel auto-deploy. Fully static (SSG), no database, no runtime fs access.

## Owner context

- Kyrylo, high-school student in Ontario, heading into cybersecurity (Security+, then Cyber Science at TMU). Not a professional developer — keep changes simple, documented, and low-maintenance.
- Design reference: brianlovin.com (sidebar rail, list-detail, near-black dark mode). Original implementation, inspired only.

## Hard rules

1. **Never make content edits outside `vault/`** unless asked — content belongs to the owner via Obsidian.
2. **Keep the site fully static.** No runtime fs reads, no server actions for content. Everything resolves at build time via `generateStaticParams`.
3. **Keep `vault/` conventions stable** (folder + `main.md` = section; other `.md` = entries). Breaking these breaks the owner's Obsidian workflow.
4. **Update `docs/DECISIONS.md`** when you make a non-obvious architectural choice.
5. Assets: never reference vault files directly from components — they're mirrored to `public/vault-assets/` by `scripts/sync-assets.mjs` (runs via predev/prebuild).

## Codebase map

| Path | Role |
|---|---|
| `vault/` | Content (Obsidian vault lives at repo root; this is the content subfolder) |
| `lib/vault.ts` | Content engine: section/entry discovery, slugs, frontmatter, sorting |
| `lib/markdown.ts` | Obsidian syntax preprocessing (`![[img]]`, `[[wiki links]]`, relative images) + unified pipeline → HTML |
| `lib/highlight.ts` | Shiki build-time syntax highlighting (explicit language list, dual light/dark themes as CSS vars) |
| `lib/previews.ts` | Build-time href → preview index behind link hover cards |
| `lib/section-types.tsx` | Registry: section `type` → list component. Extend page styles here |
| `components/Chrome.tsx` | Site chrome: sticky header ("Section · Kyrylo" breadcrumb), slide-in drawer sidebar (hidden by default), social links, page transition wrapper |
| `components/icons.tsx` | Inline SVG icon set; `resolveIcon()` maps vault frontmatter emoji/names → SVGs, unknown emoji render as text |
| `lib/site-config.ts` | Site name + social links (owner edits URLs here) |
| `components/lists/` | List-style components, one per section type |
| `app/page.tsx` | Home = section with slug `home` |
| `app/[section]/page.tsx` | Section pages (`dynamicParams = false`) |
| `app/[section]/[slug]/page.tsx` | Entry pages |
| `scripts/sync-assets.mjs` | Mirrors non-md vault files → `public/vault-assets/` |

## Conventions

- Frontmatter (section `main.md`): `title`, `icon`, `order`, `description`, `type`, `slug` (override), `draft`. Full frontmatter is exposed as `section.meta` so section types can define their own keys (e.g. `music` reads `playlists:`).
- Section types: `posts` (default; category filter chips from entry `category:` frontmatter — chips are links to `/posts?category=X`, read by `useSearchParams()` in `PostListClient`, so a post's own category chip lands here pre-filtered. Unlike the shelf these are NOT separate pages: no per-category title/OG/sitemap entry, and filtering needs JS), `music` (Apple Music iframe embeds — `lib/apple-music.ts`, no API key), `people` (cover-image grid; entry `cover:` frontmatter, initials fallback), `shelf` (Netflix-style: one horizontally-scrolling row per medium, each linking to `/<section>/type/<medium>`; entry `cover:` + `author:` + `medium: book|movie|show|video` + optional `rating: 0–5` halves allowed + optional `coverFit: contain` + optional `status: reading` (also `watching`/`current`/`in-progress`) which badges the cover "Reading" or "Watching" depending on the medium — anything else, or no key at all, reads as finished and stays unlabelled; alias `books`. `medium: video` + `video: <youtube url>` renders a 16:9 card with a play badge and derives the thumbnail from the video ID — no `cover:` needed. Row order and grouping live in `lib/shelf.ts`. `categories: [Tech, Education]` (multi-valued) drives filter chips on the medium page and renders as `#tags` under the entry title — the section page shows neither), `projects` (TIL-style inline feed; async list component), `now` (nownownow-style status cards from structured `items:` frontmatter — icon/label/label_uk/note/note_uk/link per item, plus `updated:`/`updated_uk:`; body stays empty. An optional `resume:` key in the same frontmatter renders the résumé block below the cards — see Features). Markdown pipeline also auto-embeds standalone Apple Music and YouTube links (`lib/youtube.ts`, served from youtube-nocookie.com; handles watch/youtu.be/shorts/live URLs).
- Filterable lists are split server/client: `PostList`→`PostListClient` (server slims entries to serializable rows). The shelf is fully server-rendered — medium rows replaced its filter chips, so it needs no client state.
- Design is monochrome: no blue accent in hovers/active states; `--accent` remains only for the odd functional case. Active chips/nav use text-on-bg inversion.
- Entry frontmatter is exposed as `entry.meta` (same pattern as `section.meta`) for type-specific keys.
- Frontmatter (entries): `title`, `date` (YYYY-MM-DD), `description`, `slug`, `draft` (or `published: false`).
- Sized image embeds ≤128px (e.g. `![[me.jpeg|93]]`) render as circular avatars (`.avatar` class); larger sizes keep the rounded-rectangle style.
- The `posts` list groups entries by year (empty years never render); row dates are DD.MM. This date treatment is posts-only — other types show full dates.
- The `projects` list truncates entries over 1000 markdown chars; "Continue reading" links to the entry's own page.
- Breadcrumb names the current page's ANCESTORS, not itself ("Posts · Kyrylo" on a post) — the page's own title is already its `<h1>`. Each part is clickable. On home, and on a section's own page, only the site name remains.
- Slugs: `slugify()` in `lib/vault.ts` — keep stable, changing it breaks URLs.
- Styling: Tailwind utility classes + CSS variables defined in `app/globals.css` (`--bg`, `--text`, `--accent`, …). Dark mode via `prefers-color-scheme`. Markdown output styled by the hand-written `.prose` classes in globals.css.
- TypeScript strict; path alias `@/*` → repo root.

## Content intake (most common task)

When Kyrylo hands you raw content (a post, book/movie thoughts, a project
update), follow **`docs/CONTENT-WORKFLOW.md`** — the full playbook. Core rules:

1. Light-touch editing only — fix typos/grammar/structure, never his voice or opinions.
2. Ask follow-ups only when genuinely ambiguous (section unclear, new category, factual gap) — batch questions, use defaults otherwise.
3. Publish directly (no `draft: true` unless he asks).
4. Add cross-site wiki links (`[[Note]]`, `[[Folder/main|Label]]` for sections) — this is expected, not optional. Give new notes an `aliases:` frontmatter list (natural phrases like "CompTIA Security+"), then retro-link: find exact mentions of the new subject in existing notes and convert those phrases into wiki links (wording untouched, edits reported).
5. Source images automatically: download covers into the vault folder (batch-ask permission first; `cover: https://…` URL as fallback). Books → Open Library; people → Wikimedia Commons only, license noted. Never random image results, never AI portraits of real people.
6. Factual notes (People, current events) end with a `## Sources` section (2–4 links used for verification). Skip for opinion/shelf/music notes.
7. Translate ALL content, both languages: `title_uk:` in frontmatter AND a full professional Ukrainian body in a sibling `<name>.uk.md` (posts) / `main.uk.md` (sections), body-only, same structure/links/embeds. A note without its `.uk.md` is unfinished. See `docs/CONTENT-WORKFLOW.md → Translation`.
8. Offer a diagram when a post/project would benefit; generate it as a self-theming `.svg` (see `docs/CONTENT-WORKFLOW.md` → Diagrams). Never hand-author Excalidraw scene JSON.
9. Write to `vault/<Section>/<Natural Title>.md`, then report path, future URL, links added, images fetched + sources, and anything you fixed or assumed.

## Common tasks

- **New page style** (e.g. projects grid): see `docs/ADDING-PAGE-TYPES.md`. Component in `components/lists/`, register in `lib/section-types.tsx`, set `type:` in the section's `main.md`.
- **Verify changes**: `npm run build` must pass — it statically generates every page and will surface broken content/code.

## SEO & feeds

- `app/sitemap.ts`, `app/robots.ts`, `app/feed.xml/route.ts` (RSS for Posts) — all statically generated. Canonical URL: `siteUrl` in `lib/site-config.ts` (update when custom domain lands).
- OG images generated at build via `next/og` — shared renderer in `lib/og.tsx`, route files `app/opengraph-image.tsx` + per-section + per-entry.
- Favicon: `app/icon.png` (circle-cropped from the owner's avatar) + `app/apple-icon.png`. Regenerate with PIL if the avatar changes.

## Features to know about

- **Drafts**: `draft: true` entries/sections are visible in `npm run dev` with an amber "Draft" badge, excluded from production builds (`SHOW_DRAFTS` in `lib/vault.ts`).
- **Wiki links** resolve across ALL sections via `getWikiIndex()` (file name, title, slug, or `aliases:` frontmatter — case-insensitive; aliases are Obsidian-native so links work in both places). Unknown targets fall back to same-section slug. For links to SECTION pages use `[[Folder/main|Label]]` — it resolves on the site AND opens the right file in Obsidian (bare `[[Now]]` would create a new note there).
- **Callouts**: Obsidian `> [!note] Title` → styled `.callout` divs (colors per type in globals.css).
- **Progress bars**: `[progress:: 45]` inline in any note → styled bar + percent label (plain text in Obsidian). Used on the Now page.
- **Diagrams**: `![[Drawing.excalidraw]]` embeds resolve to the Excalidraw plugin's exported SVG (theme-aware if light+dark exported); AI diagrams are self-theming `.svg` files embedded like images. **Self-theming SVGs are inlined into the page** (`inlineSelfThemingSvg` in `lib/markdown.ts`, styles namespaced to `#d-<filename>`) — through `<img>` the browser caches the rasterized image and freezes its `prefers-color-scheme` at first decode, so diagrams got stuck in the wrong theme. Two-file Excalidraw exports still use `<img>`. Resolver: `getAssetIndex()` in `lib/vault.ts` (basename→URL, vault-wide) + `resolveExcalidraw`/`diagramFigure`/`themedImg` in `lib/markdown.ts`. `.dark.<ext>` sibling → theme swap; `.uk.<ext>` sibling (or `Drawing.uk.excalidraw`) → language swap; caption `EN :: UK` splits by language. `.excalidraw.md` excluded from pages; `.excalidraw` JSON not shipped. Full guide: `docs/EXCALIDRAW.md`; AI workflow: `docs/CONTENT-WORKFLOW.md`.
- **Language toggle**: sidebar flag switch (English default / Ukrainian). `components/T.tsx` renders both languages as spans; CSS on `html[data-lang]` shows the active one (choice persisted in localStorage, restored pre-paint by inline script in `app/layout.tsx`). Titles translate via `title_uk:` frontmatter (`ukTitle()` in `lib/vault.ts`). Fixed UI strings live in `lib/ui-strings.ts` (`ui` dict of `{en, uk}` pairs — spread into `<T {...ui.key} />`; add a key there instead of hard-coding English). Dates: `displayDate` / `displayDateUk` wrapped in `<T>`. No routing, no double build. Section bodies use a sibling `main.uk.md` and entry bodies a sibling `<name>.uk.md` (read into `contentUk`, rendered in a `.lang-uk` block). Every note should carry its `.uk.md` translation — it's part of the content-intake workflow, not optional.
- **Figures/lightbox**: standalone images with alt text render as figure+figcaption; all non-avatar content images open in `components/Lightbox.tsx` on click.
- **Reading time**: `readingStats()` shown on posts-type entry pages only.
- **Search**: Cmd/Ctrl+K palette (`components/CommandPalette.tsx`) over a build-time index from `getSearchIndex()` — fully static, no backend. Every h2/h3 is indexed as its own jump-to-anchor result labelled with the note it's in; those ids are minted with `github-slugger` (what rehype-slug uses) rather than `slugify()`, which would strip Cyrillic and break every Ukrainian anchor. Heading results carry `lang` and only show in the matching language, since each language's heading has a different anchor.
- **Copy as Markdown**: icon button beside the entry title (`components/CopyMarkdown.tsx`) copying the note's raw vault source in whichever language is active. Clipboard fallback shared with the code-block buttons in `lib/clipboard.ts`.
- **Code blocks**: highlighted at build time by Shiki (`lib/highlight.ts` + the `rehypeCodeBlocks` step in `lib/markdown.ts`), wrapped in `<figure class="code-block">`. Optional filename header via ` ```bash title="scan.sh" ` (a bare `scan.sh` after the language works too). Languages must be listed in `LANGS` in `lib/highlight.ts` — unknown ones fall back to plain text. Copy button injected by `components/CodeCopy.tsx`. Zero client-side highlighting JS.
- **Résumé** (`components/Resume.tsx`): rendered under the Now cards from a `resume:` key in `vault/Now/main.md` — summary, experience/education/certifications timelines, strengths, languages, contact. Every field takes a `_uk` sibling; bullet strings use a `Label — detail` convention and the em dash splits the bold lead-in. `scripts/build-resume-pdf.py` renders the downloadable PDF from that same frontmatter (`pip install weasyprint pyyaml`, run by hand — deliberately not in `prebuild`). The PDF is public, so it carries email + city only — no phone number or street address anywhere in the repo. Its block list (Experience/Education/…) is defined once in `lib/resume.ts` and shared by the component, the Now page's `<Toc>` outline, and Cmd+K search (a dedicated "Résumé" result plus one per block, jumping to `#resume` / `#experience` / …). `/resume` redirects to `/now` (`next.config.ts`). See `docs/DECISIONS.md` #25.
- **Link hover previews**: internal links in `.prose` show a preview card on hover — title, excerpt, date, cover — from `getLinkPreviews()` in `lib/previews.ts`, passed to `components/LinkPreview.tsx` from the layout. Pointer devices only; the card is non-interactive.

## Planned / future (do not build unless asked)

- Supabase for dynamic features (post views, reactions, AMA). Deliberately not used for content — see `docs/DECISIONS.md` #1.
- More section types (stack, TIL).
