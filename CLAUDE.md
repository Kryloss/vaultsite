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
- Section types: `posts` (default; category filter chips from entry `category:` frontmatter), `music` (Apple Music iframe embeds — `lib/apple-music.ts`, no API key), `people` (cover-image grid; entry `cover:` frontmatter, initials fallback), `shelf` (2:3 vertical covers + medium filter chips; entry `cover:` + `author:` + `medium: book|movie|show`; alias `books`), `projects` (TIL-style inline feed; async list component). Markdown pipeline also auto-embeds standalone Apple Music links.
- Filterable lists are split server/client: `PostList`→`PostListClient`, `ShelfGrid`→`ShelfGridClient` (server slims entries to serializable rows).
- Design is monochrome: no blue accent in hovers/active states; `--accent` remains only for the odd functional case. Active chips/nav use text-on-bg inversion.
- Entry frontmatter is exposed as `entry.meta` (same pattern as `section.meta`) for type-specific keys.
- Frontmatter (entries): `title`, `date` (YYYY-MM-DD), `description`, `slug`, `draft` (or `published: false`).
- Sized image embeds ≤128px (e.g. `![[me.jpeg|93]]`) render as circular avatars (`.avatar` class); larger sizes keep the rounded-rectangle style.
- The `posts` list groups entries by year (empty years never render); row dates are DD.MM. This date treatment is posts-only — other types show full dates.
- The `projects` list truncates entries over 1000 markdown chars; "Continue reading" links to the entry's own page.
- Breadcrumb shows the full path ("Entry · Section · Kyrylo"), each part clickable — entry titles are passed to `Chrome` via layout.
- Slugs: `slugify()` in `lib/vault.ts` — keep stable, changing it breaks URLs.
- Styling: Tailwind utility classes + CSS variables defined in `app/globals.css` (`--bg`, `--text`, `--accent`, …). Dark mode via `prefers-color-scheme`. Markdown output styled by the hand-written `.prose` classes in globals.css.
- TypeScript strict; path alias `@/*` → repo root.

## Content intake (most common task)

When Kyrylo hands you raw content (a post, book/movie thoughts, a project
update), follow **`docs/CONTENT-WORKFLOW.md`** — the full playbook. Core rules:

1. Light-touch editing only — fix typos/grammar/structure, never his voice or opinions.
2. Ask follow-ups only when genuinely ambiguous (section unclear, new category, factual gap) — batch questions, use defaults otherwise.
3. Publish directly (no `draft: true` unless he asks).
4. Add cross-site wiki links (`[[Note]]`, `[[Folder/main|Label]]` for sections) — this is expected, not optional.
5. Write to `vault/<Section>/<Natural Title>.md`, then report path, future URL, links added, and anything you fixed or assumed.

## Common tasks

- **New page style** (e.g. projects grid): see `docs/ADDING-PAGE-TYPES.md`. Component in `components/lists/`, register in `lib/section-types.tsx`, set `type:` in the section's `main.md`.
- **Verify changes**: `npm run build` must pass — it statically generates every page and will surface broken content/code.

## SEO & feeds

- `app/sitemap.ts`, `app/robots.ts`, `app/feed.xml/route.ts` (RSS for Posts) — all statically generated. Canonical URL: `siteUrl` in `lib/site-config.ts` (update when custom domain lands).
- OG images generated at build via `next/og` — shared renderer in `lib/og.tsx`, route files `app/opengraph-image.tsx` + per-section + per-entry.
- Favicon: `app/icon.png` (circle-cropped from the owner's avatar) + `app/apple-icon.png`. Regenerate with PIL if the avatar changes.

## Features to know about

- **Drafts**: `draft: true` entries/sections are visible in `npm run dev` with an amber "Draft" badge, excluded from production builds (`SHOW_DRAFTS` in `lib/vault.ts`).
- **Wiki links** resolve across ALL sections via `getWikiIndex()` (file name, title, or slug — case-insensitive). Unknown targets fall back to same-section slug. For links to SECTION pages use `[[Folder/main|Label]]` — it resolves on the site AND opens the right file in Obsidian (bare `[[Now]]` would create a new note there).
- **Callouts**: Obsidian `> [!note] Title` → styled `.callout` divs (colors per type in globals.css).
- **Figures/lightbox**: standalone images with alt text render as figure+figcaption; all non-avatar content images open in `components/Lightbox.tsx` on click.
- **Reading time**: `readingStats()` shown on posts-type entry pages only.
- **Search**: Cmd/Ctrl+K palette (`components/CommandPalette.tsx`) over a build-time index from `getSearchIndex()` — fully static, no backend.

## Planned / future (do not build unless asked)

- Supabase for dynamic features (post views, reactions, AMA). Deliberately not used for content — see `docs/DECISIONS.md` #1.
- More section types (stack, TIL).
