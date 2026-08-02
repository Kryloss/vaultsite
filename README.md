# Vaultsite

Personal portfolio published straight from an Obsidian vault. Folders become pages, notes become posts, git push becomes deploy.

**Stack:** Next.js 15 (App Router, static generation) · Tailwind CSS v4 · Obsidian + Obsidian Git · GitHub · Vercel. Design inspired by [brianlovin.com](https://brianlovin.com).

## How publishing works

```
Obsidian (edit note) → Obsidian Git (auto commit + push) → GitHub → Vercel (auto rebuild) → live
```

No database, no CMS. Git is the single source of truth. Publish latency ≈ 1 minute (Vercel build).

## Content rules

| You do this in Obsidian | Site does this |
|---|---|
| Create folder `Posts/` with `main.md` | New page at `/posts`, added to sidebar |
| Add `Posts/How was my day.md` | Listed on `/posts`, own page at `/posts/how-was-my-day` |
| Paste an image into a note | Served automatically (keep attachments in the note's folder) |
| Add `draft: true` to frontmatter | Hidden from the site |
| Delete a note | Removed from the site on next deploy |

`main.md` frontmatter: `title`, `icon` (emoji), `order` (sidebar position), `description`, `type` (list style, default `posts`).
Entry frontmatter: `title`, `date` (YYYY-MM-DD), `description`, `draft`.

**Diagrams:** embed Excalidraw drawings with `![[Name.excalidraw]]` (turn on the plugin's Auto-export SVG; light+dark exports become theme-aware). AI-made diagrams are self-theming `.svg` files embedded like images. A photographed handwritten note can become an **Image note**: a clean bilingual diagram with a one-click switch back to the original photo. See [docs/EXCALIDRAW.md](./docs/EXCALIDRAW.md).

**Section types:** `posts` (year-grouped rows; entries can set `category:` for filter chips) · `music` (Apple Music playlist embeds via `playlists:` frontmatter + notes below) · `people` (square cover-image grid; entries set `cover: photo.jpg`) · `shelf` (Netflix-style: one horizontally-scrolling row per medium, each opening its own page; entries set `cover:`, `author:`, `medium: book|movie|show|video`, optional `rating:` and `status: reading`) · `projects` (full entries rendered inline, TIL-style) · `now` (a nownownow-style page: a goals checklist and a résumé, both written as markdown in `main.md`'s body). Any Apple Music or YouTube link pasted alone on a line in any note also becomes an embedded player.

## Local development

```bash
npm install
npm run dev   # http://localhost:3000
npm run build # must pass — it statically generates every page
npm test      # unit tests for lib/ (Node's own runner, no framework)
```

## Key files

- `vault/` — all content. **The only folder you touch day-to-day.**
- `lib/vault.ts` — folder→page engine
- `lib/markdown.ts` — markdown + Obsidian syntax → HTML
- `lib/section-types.tsx` — registry of page styles (extend here)
- `app/globals.css` — design tokens (colour, radius, motion, page shell) + all hand-written styles
- `components/Page.tsx` — the page shell every route wraps in
- `app/` — routes and layout
- `scripts/sync-assets.mjs` — copies vault images to `public/` before build

## Docs

- [SETUP.md](./SETUP.md) — one-time setup: GitHub, Vercel, Obsidian
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — how everything fits together
- [docs/ADDING-PAGE-TYPES.md](./docs/ADDING-PAGE-TYPES.md) — adding new page styles
- [docs/DECISIONS.md](./docs/DECISIONS.md) — why things are the way they are
- [CLAUDE.md](./CLAUDE.md) — context file for AI assistants working on this repo
