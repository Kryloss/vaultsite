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

- **Section** = TOP-LEVEL folder in `vault/` containing `main.md`. Gets a route (`/posts`), a sidebar item, and a list of its entries. The folder `Home` is special only in that its slug `home` renders at `/`.
- **Entry** = any other `.md` file in a section folder, including inside its subfolders. Gets a route `/<section>/<slug>`.
- **Subfolders are filing, not structure.** `vault/Shelf/Books/Sapiens.md` is still `/shelf/sapiens` — the slug comes from the file name, so notes can be reorganized in Obsidian without breaking URLs, and only top-level folders can ever become sections. Images sit beside their note; `entry.sectionDir` carries the note's own folder so they resolve. The one exception to "means nothing": a shelf note with no `medium:` inherits it from its folder (`lib/shelf.ts` → `entryMedium()`).
- Slug = slugified folder/file name, overridable via frontmatter `slug`.
- `draft: true` (or `published: false`) hides sections or entries.
- A section's body is markdown, rendered as prose above its list — except `type: now`, whose body IS its data: `lib/now-content.ts` parses the goals checklist and the résumé out of it into `section.meta.goals` / `section.meta.resume`. See DECISIONS #26.

## Rendering pipeline (lib/markdown.ts)

1. Regex preprocessing converts Obsidian-isms to standard markdown:
   - `![[img.png|alt]]` → `![alt](/vault-assets/<Folder>/img.png)`
   - `[[Note Name|label]]` → `[label](/<section>/<note-slug>)` (same-section links)
   - `![alt](relative.png)` → absolute `/vault-assets/...` URL
2. unified pipeline: remark-parse → remark-gfm → remark-rehype (raw HTML allowed) → rehype-raw → rehype-slug → a series of local rehype steps → rehype-stringify. The local steps do the site-specific work: Shiki syntax highlighting and the code-block chrome (`rehypeCodeBlocks`), intrinsic `width`/`height` + `srcset` on content images (`rehypeImageSize`), footnotes promoted to margin sidenotes (`rehypeSidenotes`), Obsidian callouts, `[progress:: n]` bars, figure/caption wrapping, Apple Music and YouTube auto-embeds, and inlining self-theming SVG diagrams (`inlineSelfThemingSvg` — through an `<img>` the browser freezes the diagram's `prefers-color-scheme` at first decode).
3. Output injected via `dangerouslySetInnerHTML`, styled by `.prose` CSS in `app/globals.css`. Safe because the only markdown author is the site owner.

## Why images go through public/

Next.js only serves static files from `public/`. Instead of a runtime file-serving route (needs `outputFileTracingIncludes`, breaks static export), a prebuild script mirrors every non-`.md` vault file into `public/vault-assets/`. Simple, debuggable, works identically in dev and on Vercel.

## UI structure

- `app/layout.tsx` (server) reads sections → passes nav items to `components/Chrome.tsx` (client), which owns all site chrome.
- The sidebar is a slide-in **drawer**, closed by default at every width, opened from the floating pill at the top-left that also carries the breadcrumb. It's a modal dialog: focus trapped while open, restored on close, `inert` when closed.
- **There is no permanent nav rail at any width**, and one was built and deleted rather than kept — see DECISIONS #62 before proposing another. The only standing rail is `.toc-rail`, the article's own contents list, from 1280px.
- Every route wraps its content in `components/Page.tsx` rather than repeating a container — see Design system below.
- Section entry lists are pluggable via `lib/section-types.tsx` (see ADDING-PAGE-TYPES.md).

## Design system

**Light/dark** is `prefers-color-scheme` only — there is no manual toggle. It works by re-declaring the colour tokens in a media query.

**The design** — serif typeface throughout, large fluid page titles, a wide tonal range, no accent colour at all — state chips, the ToC marker, progress bars and focus rings are `--text` (DECISIONS #64), dark mode with `--surface` sitting above `--bg` — lives in one block at the foot of `globals.css`, kept together because the rules explain each other. It shipped briefly as one of two switchable themes so it could be judged against the design it replaced; that switch is gone (DECISIONS #59).

Everything is built from tokens at the top of `globals.css`:

| Group | Tokens | Notes |
|---|---|---|
| Colour | `--bg`, `--bg-sidebar`, `--bg-hover`, `--surface`, `--text`, `--text-secondary`, `--text-tertiary`, `--border`, `--code-bg` | `--surface` is the FILL of a card or cover box; `--bg-hover` is the response to a pointer. |
| Floating chrome | `--chrome-bg`, `--chrome-ring` | The breadcrumb bar, contents pill, time-left chip and reading-position offer. Built from `--surface` in dark mode so a pill isn't the same colour as the page it hovers over (DECISIONS #60). |
| Radius | `--r-xs` … `--r-xl`, `--r-full` | 4/6/8/12/16px + pill, deliberately equal to Tailwind's scale so utilities and hand-written rules can't drift. |
| Motion | `--ease`, `--dur-fast`, `--dur`, `--dur-slow` | 120/200/320ms. Tailwind's `--default-transition-*` point at these, so `transition-colors` moves like the hand-written rules. |
| Page shell | `--measure`, `--gutter`, `--page-y` | Read by `.page` (components/Page.tsx). |

Two behaviours are worth knowing before editing the stylesheet:

- **`.press`** dips any control to 97% while it's held (`.press-soft` → 99% for cards). Opt-in, because scaling an inline prose link reads as a rendering fault. The block sits at the very END of `globals.css` — several components declare their own `transition:` shorthand hundreds of lines earlier, and a shorthand resets transform. Overrides belong below what they override (DECISIONS #52, #55).
- Typeface: **Source Serif 4** and nothing else. It sets everything except code; its own italic is the quotes voice. Self-hosted by `next/font` with the **cyrillic** subset (non-negotiable — every note carries a Ukrainian translation) and with `axes: ["opsz"]`, without which the optical-size axis isn't in the file and `font-optical-sizing` has nothing to act on (DECISIONS #61).

## Repo layout note

The Obsidian vault root = repo root (open the whole repo as a vault). This keeps the Obsidian Git plugin happy (it expects the git repo at vault root) while code and content coexist. The owner only edits `vault/`.
