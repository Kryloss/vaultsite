# Architecture

## Data flow

```
┌──────────┐   auto commit+push   ┌────────┐   webhook   ┌────────┐
│ Obsidian │ ───────────────────▶ │ GitHub │ ──────────▶ │ Vercel │
│ (vault/) │    (Git plugin)      └────────┘             │ build  │
└──────────┘                                             └───┬────┘
                                                             ▼
                              1. scripts/sync-assets.mjs  (prebuild)
                                 vault images → public/vault-assets/
                              2. next build (SSG)
                                 lib/vault.ts reads vault/ from fs,
                                 every page pre-rendered to static HTML
```

Git is the single source of truth. The deployed site never reads the filesystem at runtime — `dynamicParams = false` on all dynamic routes, so the full site is static HTML on Vercel's CDN.

## Content model

- **Section** = folder in `vault/` containing `main.md`. Gets a route (`/posts`), a sidebar item, and a list of its entries. The folder `Home` is special only in that its slug `home` renders at `/`.
- **Entry** = any other `.md` file in a section folder. Gets a route `/<section>/<slug>`.
- Slug = slugified folder/file name, overridable via frontmatter `slug`.
- `draft: true` (or `published: false`) hides sections or entries.
- A section's body is markdown, rendered as prose above its list — except `type: now`, whose body IS its data: `lib/now-content.ts` parses the goals checklist and the résumé out of it into `section.meta.goals` / `section.meta.resume`. See DECISIONS #26.

## Rendering pipeline (lib/markdown.ts)

1. Regex preprocessing converts Obsidian-isms to standard markdown:
   - `![[img.png|alt]]` → `![alt](/vault-assets/<Folder>/img.png)`
   - `[[Note Name|label]]` → `[label](/<section>/<note-slug>)` (same-section links)
   - `![alt](relative.png)` → absolute `/vault-assets/...` URL
2. unified pipeline: remark-parse → remark-gfm → remark-rehype (raw HTML allowed) → rehype-raw → rehype-slug → rehype-stringify.
3. Output injected via `dangerouslySetInnerHTML`, styled by `.prose` CSS in `app/globals.css`. Safe because the only markdown author is the site owner.

## Why images go through public/

Next.js only serves static files from `public/`. Instead of a runtime file-serving route (needs `outputFileTracingIncludes`, breaks static export), a prebuild script mirrors every non-`.md` vault file into `public/vault-assets/`. Simple, debuggable, works identically in dev and on Vercel.

## UI structure

- `app/layout.tsx` (server) reads sections → passes nav items to `Sidebar` (client, handles mobile drawer).
- Fixed 240px left rail on desktop; top bar + slide-over below `lg`.
- Theme: CSS variables in `globals.css`, dark via `prefers-color-scheme`. To add a manual toggle later, switch the dark block to a `.dark` class strategy.
- Section entry lists are pluggable via `lib/section-types.tsx` (see ADDING-PAGE-TYPES.md).

## Repo layout note

The Obsidian vault root = repo root (open the whole repo as a vault). This keeps the Obsidian Git plugin happy (it expects the git repo at vault root) while code and content coexist. The owner only edits `vault/`.
