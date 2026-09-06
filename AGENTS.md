# AGENTS.md — Codex project guidance

Instructions for Codex and other agents working on Vaultsite. This file applies to the whole repository. It is an INDEX: read it, then open the `docs/*.md` file the routing table names for the task at hand. Claude Code loads `CLAUDE.md`, which carries the same body below the marker line; treat both as repository documentation, not as instructions for a different project.

<!-- shared: everything below this line is identical in CLAUDE.md and AGENTS.md; scripts/docs.test.mjs asserts it -->

## What this is

Kyrylo's portfolio site, published from an Obsidian vault. The `vault/` folder IS the CMS: TOP-LEVEL folders → section pages, `.md` files inside them → entries with their own URLs; subfolders are filing and never appear in a URL. Pipeline: Obsidian Git → GitHub → Vercel auto-deploy. Fully static (SSG), no database, no runtime fs access. Read `docs/ARCHITECTURE.md` before changing code or site structure.

Owner: Kyrylo, high-school student in Ontario, heading into cybersecurity. Not a professional developer — keep changes simple, documented, and low-maintenance. Design reference: brianlovin.com (sidebar rail, list-detail, near-black dark mode). Original implementation, inspired only.

## Hard rules

1. **Never make content edits outside `vault/`** unless asked — content belongs to the owner via Obsidian. Never touch `vault/` as a side effect of code work: it auto-publishes.
2. **Keep the site fully static.** No runtime fs reads, no server actions for content. Everything resolves at build time via `generateStaticParams`; `dynamicParams = false` stays. The one exception is the localhost authoring sidecar (`docs/LOCAL-AUTHORING.md`), which production never starts.
3. **Keep `vault/` conventions stable** (top-level folder + `main.md` = section; other `.md` = entries, at any depth inside it). Do not change `slugify()` semantics casually — existing URLs depend on them.
4. **Update `docs/DECISIONS.md`** when you make a non-obvious architectural choice. Append at the bottom; never renumber.
5. Assets: never reference vault files directly from components — they're mirrored to `public/vault-assets/` by `scripts/sync-assets.mjs` (runs via predev/prebuild).
6. Any new UI must work in English and Ukrainian, light and dark, and under `prefers-reduced-motion`. Do not add a manual theme switch, an accent colour, or a second typeface.
7. Do not build items under "Planned / future" (`docs/SECTIONS.md`) unless the user asks.
8. Do not commit, push, deploy, or add dependencies unless the user requests that action or it is clearly part of their stated task.
9. **Code and `docs/DECISIONS.md` are the source of truth.** Where prose disagrees with the code, the code wins — flag it, don't "fix" the code to match a stale sentence.

## Two agents work on this repo

Claude Code and Codex are both used here, on the same checkout. Each auto-loads its own file (`CLAUDE.md` / `AGENTS.md`); both are INDEXES and route to the same `docs/*.md` topic files, which are shared and authoritative.

- **Change a convention, command, or invariant → update BOTH entry files in the same change** (the shared part below the marker line must stay byte-identical — `npm test` checks), plus the topic file it belongs to, plus `docs/DECISIONS.md` if the choice is non-obvious. Feature detail belongs in a topic file, never in an entry file.
- **One agent at a time in this working tree.** Obsidian Git auto-commits *everything* (`autoCommitOnlyStaged: false`) every 10 minutes and pushes, and Vercel deploys the result — so a half-finished edit publishes itself on a timer. Finish and verify a change, or work in a separate `git worktree`. Don't run Claude and Codex against this checkout simultaneously.
- **Check `git status --short` before editing.** Uncommitted changes you don't recognise may be the other agent's or the owner's in-flight work: leave them alone and ask. Never `git restore`, `git checkout --`, or `git stash` a file you didn't change yourself.

## Working agreements for code

- Keep TypeScript strict and use the `@/*` alias for repository-root imports. Reuse current patterns before introducing a new helper, abstraction, package, client component, or state store.
- Preserve server rendering. Add `"use client"` only when browser state or an event handler requires it; keep the client boundary thin. A server component RENDERED BY a client one still ships to the browser and so cannot import `lib/vault.ts` — anything a client component might need sits in a module with no server-only imports (`lib/dates.ts`, `lib/categories.ts`, `lib/music-filter.ts`).
- All routes use `<Page>`; never re-type its container. Use the tokens, not literals; give clickable things `press`; `globals.css` has no `@layer`, so an override goes BELOW what it overrides — `docs/DESIGN-SYSTEM.md` before any CSS.
- Fixed bilingual UI goes through `components/T.tsx` + `lib/ui-strings.ts`; any string with a COUNT in it goes through `lib/plural.ts`.
- Scroll maths and anything the vault can't exercise lives in `lib/` as pure functions with `npm test` coverage (`lib/reading-progress.ts`, `lib/toc-spy.ts`, `lib/observances.ts`, `lib/siblings.ts`, …). Reader state derived from localStorage renders after hydration and starts hidden.
- Respect the accessibility patterns already present: semantic controls, keyboard behaviour, focus management, `inert` for closed dialogs, reduced motion, usable touch states.
- Extend the build-time Markdown pipeline rather than adding client-side Markdown or highlighting work.

## Content intake (most common task)

When Kyrylo hands you raw content, follow **`docs/CONTENT-WORKFLOW.md`** — the full playbook. Core rules: light-touch editing only, his voice stays; ask only when genuinely ambiguous, batched; publish directly (no `draft: true` unless he asks); add wiki links and `aliases:`, then retro-link existing exact mentions; source images automatically from the approved sources, batch-ask before downloading, never random image results or AI portraits; factual notes end with `## Sources`; **translate ALL content, both languages** — `title_uk:` plus a full body in a sibling `.uk.md`, a note without one is unfinished; write to `vault/<Section>/…` (matching subfolder where one exists) and report path, URL, links, images and sources, fixes and assumptions.

## Verify

Full loop in `docs/VERIFY.md`. Before handing off:

```bash
npm run check
```

(`typecheck` → `tsc --noEmit`, `test` → `lib/*.test.ts` + `scripts/*.test.mjs` including the docs index test, `validate:image-notes`.) Then `npm run build` — **never while `npm run dev` is up**: they share `.next/`; stop the dev server or run `node scripts/isolated-build.mjs`. Lint: `npm run lint` (`eslint .`, Next's flat configs); NOT part of `check` while the baseline has pre-existing findings — see `docs/VERIFY.md` for the counts and the rule. For UI changes also look at the view in both languages, light and dark, and at phone / laptop / ≥1168px widths. Report exactly which checks ran.

## Where to look (routing table)

| Task | Read |
|---|---|
| How everything fits together, tokens, rendering pipeline | `docs/ARCHITECTURE.md` |
| Any CSS or new UI; monochrome rule; breakpoints; `globals.css` traps | `docs/DESIGN-SYSTEM.md` |
| Vault model, frontmatter, posts / projects / people / now / home | `docs/SECTIONS.md` |
| The shelf: mediums, games, spines, Top lists, studios, creator block, fact tables, note gutter column, thumbnail, IMDb | `docs/SHELF.md` |
| Music: cover deck, filter and `lang:`, Apple Music players and crops, music note | `docs/MUSIC.md` |
| Sidebar drawer and its parked tree, constellation, national days line, breadcrumb, intro, shortcuts, Cmd+K, motion | `docs/CHROME.md` |
| Reading bar, read notes, reading position, New badge, series, contents rail and scroll-spy, sidenotes, previews, lightbox | `docs/READING.md` |
| Markdown pipeline, callouts, code blocks, wiki links, images, language toggle, counted nouns | `docs/MARKDOWN.md` |
| Canonicals, JSON-LD, OG cards, feeds, identity, analytics | `docs/SEO.md` |
| Content intake or any vault edit | `docs/CONTENT-WORKFLOW.md` |
| New section / list type | `docs/ADDING-PAGE-TYPES.md` |
| Excalidraw, diagrams, image notes | `docs/EXCALIDRAW.md` |
| A YouTube video reaching the shelf (nightly task) | `docs/YOUTUBE-SHELF.md` |
| The localhost pencil dock and its sidecar | `docs/LOCAL-AUTHORING.md` |
| Checks to run, isolated build, lint status | `docs/VERIFY.md` |
| Why something is the way it is | search `docs/DECISIONS.md` (index at the top; `#N` references are stable) |

Search the topic file before modifying an existing feature. Most features carry invariants that were each a visible bug once; the topic files say which.
