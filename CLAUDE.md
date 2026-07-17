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
| `components/Sidebar.tsx` | Nav (client component; items generated from vault folders in layout) |
| `components/lists/` | List-style components, one per section type |
| `app/page.tsx` | Home = section with slug `home` |
| `app/[section]/page.tsx` | Section pages (`dynamicParams = false`) |
| `app/[section]/[slug]/page.tsx` | Entry pages |
| `scripts/sync-assets.mjs` | Mirrors non-md vault files → `public/vault-assets/` |

## Conventions

- Frontmatter (section `main.md`): `title`, `icon`, `order`, `description`, `type`, `slug` (override), `draft`. Full frontmatter is exposed as `section.meta` so section types can define their own keys (e.g. `music` reads `playlists:`).
- Section types: `posts` (default), `music` (Apple Music iframe embeds — `lib/apple-music.ts`, no API key). Markdown pipeline also auto-embeds standalone Apple Music links.
- Frontmatter (entries): `title`, `date` (YYYY-MM-DD), `description`, `slug`, `draft` (or `published: false`).
- Slugs: `slugify()` in `lib/vault.ts` — keep stable, changing it breaks URLs.
- Styling: Tailwind utility classes + CSS variables defined in `app/globals.css` (`--bg`, `--text`, `--accent`, …). Dark mode via `prefers-color-scheme`. Markdown output styled by the hand-written `.prose` classes in globals.css.
- TypeScript strict; path alias `@/*` → repo root.

## Common tasks

- **New page style** (e.g. projects grid): see `docs/ADDING-PAGE-TYPES.md`. Component in `components/lists/`, register in `lib/section-types.tsx`, set `type:` in the section's `main.md`.
- **Verify changes**: `npm run build` must pass — it statically generates every page and will surface broken content/code.

## Planned / future (do not build unless asked)

- Supabase for dynamic features (post views, reactions, AMA). Deliberately not used for content — see `docs/DECISIONS.md` #1.
- More section types (projects, stack, TIL).
- RSS feed, sitemap, OG images.
