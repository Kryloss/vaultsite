# AGENTS.md — Codex project guidance

Instructions for Codex and other agents working on Vaultsite. This file applies
to the whole repository.

## Start here

1. Read this file before doing any work.
2. Read `docs/ARCHITECTURE.md` before changing code or site structure.
3. Check `git status --short` before editing. Preserve unrelated and in-progress
   user changes; never discard, overwrite, or reformat them as collateral work.
4. Read only the task-relevant deeper guidance:
   - Content intake or vault edits → `docs/CONTENT-WORKFLOW.md`
   - New section/list type → `docs/ADDING-PAGE-TYPES.md`
   - Excalidraw or diagrams → `docs/EXCALIDRAW.md`
   - Existing architectural/design behavior → search `docs/DECISIONS.md`
   - Detailed feature inventory → search the relevant section of `CLAUDE.md`

`CLAUDE.md` is the expanded, tool-neutral project reference originally written
for Claude. Codex must treat it as repository documentation, not as instructions
for a different project. Search it before modifying an existing feature, but use
this smaller file as the always-loaded map. Code and the targeted decision record
remain the source of truth if prose has drifted.

## Two agents work on this repo

Claude Code and Codex are both used here, on the same checkout. Each auto-loads
its own file: Codex reads this one, Claude Code reads `CLAUDE.md`, and `docs/` is
shared and authoritative for both.

- **`CLAUDE.md` owns feature detail; this file owns the map.** Do not restate
  feature detail here — point at `CLAUDE.md` instead. Duplicated prose is what
  drifts.
- **Change a convention, command, or invariant → update BOTH agent files in the
  same change**, plus `docs/DECISIONS.md` when the choice is non-obvious. The two
  files have already drifted apart once (each described a different `npm test`
  wiring), which is exactly the failure this rule prevents.
- **One agent at a time in this working tree.** Obsidian Git auto-commits
  *everything* (`autoCommitOnlyStaged: false`) every 10 minutes and pushes, and
  Vercel deploys the result — so a half-finished edit publishes itself on a
  timer. Finish and verify a change, or work in a separate `git worktree`. Do not
  run Codex and Claude against this checkout at the same time.
- **Check `git status --short` before editing.** Uncommitted changes you do not
  recognise may be the other agent's or the owner's in-flight work: leave them
  alone and ask. Never `git restore`, `git checkout --`, or `git stash` a file you
  did not change yourself.

## What this project is

Kyrylo's personal portfolio, published directly from an Obsidian vault. The
`vault/` directory is the CMS:

- A top-level folder containing `main.md` is a section and gets a section URL.
- Any other `.md` file beneath that section is an entry with its own URL.
- Subfolders are for Obsidian filing only. They never become URL segments.
- Git is the source of truth: Obsidian Git → GitHub → Vercel.
- The deployed site is fully static. Content is read only at build time.

The owner is a high-school student rather than a professional developer. Prefer
simple, documented, low-maintenance solutions over clever abstractions.

## Non-negotiable rules

1. Never edit site content outside `vault/` unless the user explicitly asks.
2. Keep content fully static: no runtime filesystem reads, content database, or
   server actions. Dynamic routes resolve at build time with
   `generateStaticParams`; `dynamicParams = false` remains intact.
3. Keep the vault model stable: top-level folder + `main.md` = section; all
   other markdown beneath it = entries. An entry slug comes from its filename
   (or explicit frontmatter override), never its subfolder path.
4. Do not change `slugify()` semantics casually. Existing URLs depend on them.
5. Never reference vault assets directly from components. `predev`/`prebuild`
   runs `scripts/sync-assets.mjs`, which mirrors them to
   `public/vault-assets/` and generates image metadata/variants.
6. Update `docs/DECISIONS.md` for a non-obvious architectural decision. Update
   the relevant user/AI docs when conventions or frontmatter change.
7. Any new UI must work in English and Ukrainian, light and dark color schemes,
   and `prefers-reduced-motion`.
8. Do not add a manual theme switch, an accent color, or a second typeface.
9. Do not build items under “Planned / future” unless the user asks for them.
10. Do not commit, push, deploy, or add dependencies unless the user requests
    that action or it is clearly part of their stated task.

## Repository map

| Path | Responsibility |
|---|---|
| `vault/` | Obsidian-authored content and its source media |
| `app/` | Next.js App Router routes, metadata routes, and global CSS |
| `components/Page.tsx` | The only page shell; owns measure, gutters, and rhythm |
| `components/Chrome.tsx` | Drawer, breadcrumb, global chrome, and page wrapper |
| `components/lists/` | Section-specific list renderers |
| `lib/vault.ts` | Section/entry discovery, slugs, frontmatter, sorting, indexes |
| `lib/markdown.ts` | Obsidian preprocessing and Markdown-to-HTML pipeline |
| `lib/section-types.tsx` | Section `type` → list component registry |
| `lib/ui-strings.ts` | Fixed English/Ukrainian UI strings |
| `lib/metadata.ts`, `lib/jsonld.ts` | Canonicals, Open Graph, and structured data |
| `scripts/sync-assets.mjs` | Build-time vault asset mirror and image manifest |
| `docs/ARCHITECTURE.md` | Stable system and design-system overview |
| `docs/DECISIONS.md` | Reasons and invariants behind non-obvious behavior |

Routes:

- `app/page.tsx` renders the section whose slug is `home`.
- `app/[section]/page.tsx` renders section pages.
- `app/[section]/[slug]/page.tsx` renders entry pages.
- Shelf medium/category routes are special filtered views documented in
  `CLAUDE.md` and `lib/shelf.ts`.

## Working agreements for code changes

- Keep TypeScript strict and use the `@/*` alias for repository-root imports.
- Reuse current patterns before introducing a new helper, abstraction, package,
  client component, or state store.
- Preserve server rendering. Add `"use client"` only when browser state or an
  event handler requires it; keep the client boundary thin.
- All routes use `<Page>`. Never duplicate its container utilities.
- Use existing CSS tokens instead of literal colors, radii, motion durations,
  page widths, or gutters.
- Interactive controls opt into `.press`; card-sized controls use
  `.press.press-soft`. Do not add `transition-colors` beside `.press` because
  `.press` owns the transition.
- `app/globals.css` has no `@layer`; source order is the tie-breaker. Put an
  override below the rule it overrides. Keep the named `.press` integration
  block at the very end because earlier `transition:` shorthands reset
  transforms.
- Use Source Serif 4 for everything except code. It is self-hosted with the
  Cyrillic subset and the `opsz` axis.
- Use `components/T.tsx` plus `lib/ui-strings.ts` for fixed bilingual UI. Do not
  hard-code a new English-only interface string.
- Keep the design monochrome. State emphasis uses `--text`; there is no
  `--accent` token. Existing semantic callout colors and documented hover-only
  brand/photo exceptions may remain.
- Respect accessibility patterns already present: semantic controls, keyboard
  behavior, focus management/restoration, `inert` for closed dialogs, reduced
  motion, and usable touch states.

## Content model and intake

For any raw post, shelf note, person, project update, music note, or Now update,
read and follow `docs/CONTENT-WORKFLOW.md` completely before editing.

Core contract:

- Light-touch edits only: fix grammar, typos, and structure without replacing
  Kyrylo's voice, opinions, or jokes.
- Ask only about genuine ambiguity; batch necessary questions and otherwise use
  documented defaults.
- Publish directly unless the user asks for a draft.
- Add useful Obsidian wiki links. New notes get natural `aliases:` values; scan
  existing notes for exact mentions and retro-link without changing wording.
- Every new/updated content note must be complete in both languages:
  `title_uk:` in English frontmatter and a full sibling `.uk.md` body with the
  same structure, links, and embeds.
- Factual People/current-event notes end with 2–4 sources used for verification.
  Opinion, shelf, and music notes do not need a sources section.
- Source images using the workflow's approved sources and licensing rules.
  Never use random image results or AI portraits of real people. Ask once before
  downloading a batch; use a remote cover URL only as fallback.
- Reuse existing categories; ask before inventing a new category or series.
- Validate frontmatter and report the written path, future URL, links, media
  sources, fixes, and assumptions.

Important conventions:

- Section `main.md`: `title`, `icon`, `order`, `description`, `type`, optional
  `slug`, optional `draft`; the complete frontmatter is exposed as
  `section.meta`.
- Entry: `title`, `date`, `description`, optional `slug`, optional `draft` (or
  `published: false`), optional `series`/`series_uk`/`part`; complete
  frontmatter is exposed as `entry.meta`.
- Section body translations use `main.uk.md`; entry translations use
  `<name>.uk.md`, body only.
- Section links use `[[Folder/main|Label]]`. Bare section names can create the
  wrong Obsidian note.
- Shelf notes go in the matching `Books/`, `Movies/`, `Shows/`, or `Videos/`
  subfolder. Those folders still do not affect URLs.
- Shelf `medium` may be explicit or inferred by `entryMedium()` from the filing
  folder. Do not invent another inference path.
- `draft: true` content appears in development and is excluded in production.

## Feature invariants worth checking before edits

- Markdown supports wiki links/embeds, relative images, callouts, progress
  fields, GFM, syntax highlighting, figures, footnotes/sidenotes, Apple Music,
  YouTube, and self-theming SVGs. Extend the existing build-time pipeline rather
  than adding client-side Markdown/highlighting work.
- English and Ukrainian share routes. The selected language is client-persisted
  and restored before paint; translated bodies render as paired language blocks.
- Search is a static `/search-index.json` fetched on first palette open. Heading
  anchors use `github-slugger`, which preserves usable Ukrainian anchors.
- Canonical metadata is required because `?lang=uk` is an indexable duplicate
  without it. Use `pageMeta()` and preserve JSON-LD, sitemap, RSS, and OG-image
  behavior when adding routes or content types.
- Reading progress, read-note state, reading position, series state, keyboard
  shortcuts, link previews, selection links, lightbox behavior, and command
  palette actions are separate features with documented invariants. Search
  `CLAUDE.md`, their implementation, tests, and matching decision records before
  changing any of them.
- Self-theming SVG diagrams are deliberately inlined; do not replace them with
  ordinary `<img>` output. Excalidraw JSON is not shipped.
- Image notes pair a bilingual SVG/Excalidraw embed with an original photo via
  `<!-- image-note: file -->`; preserve the static, diagram-first radio switch
  and its shared dimensioned stage, and strip EXIF/GPS metadata from source
  photos before they enter the vault. Reconstruction is source-faithful: extract
  a transcription map first, then hand-author identical-geometry EN/UK SVGs;
  unsupported explanatory copy is forbidden. Agent-authored semantic SVG is the
  default; Excalidraw is an optional manual-editing bridge, never hand-authored
  scene JSON. A self-theming diagram must also stay under the 64KB inline
  ceiling (`MAX_INLINE_SVG`): past it the SVG degrades to an `<img>` and freezes
  in one theme. `scripts/validate-image-notes.mjs` enforces all of this at build
  time — see `CLAUDE.md` and `docs/DECISIONS.md` #69, #71, #72.
- Content images get intrinsic dimensions, blur data, responsive WebP variants,
  `srcset`, and `sizes` at build time. Preserve that pipeline.
- The drawer and other dialogs stay mounted so close animations work; closed
  content uses `inert`, and expensive contents may be gated until first open.
  The drawer opens two KINDS of way — deliberately, by the panel icon or the
  `m` key (modal: backdrop, focus trapped), or by the pointer reaching the
  left edge (a peek: no backdrop, focus untouched, closes when the pointer
  leaves). Keep the two distinguishable; `CLAUDE.md` and `docs/DECISIONS.md`
  #74, #75 have the detail.
- Scroll maths (the reading bar, the contents scroll-spy) lives in `lib/` as
  pure functions with `npm test` coverage, not inline in the component — see
  `lib/reading-progress.ts`, `lib/toc-spy.ts`, `lib/intro.ts`,
  `lib/constellation.ts`, `docs/DECISIONS.md` #76.
- The sidebar note strip buckets notes BY WEEK, deliberately: a day grid was
  built first and misrepresented a vault whose shelf notes were typed up in
  batches. Its bar width, gap and `WEEKS` must stay consistent with the 176px
  of inner width in the `w-56` drawer. It is split server/client
  (`components/Constellation.tsx` → `components/ConstellationStrip.tsx`) so
  `lib/vault.ts` stays out of the browser bundle, and is rendered by
  `app/layout.tsx` and handed to `Chrome` as an element, never imported by
  `Chrome` itself. `today` stays a prop. The count line is hidden until hover
  or focus, and a bar opens that week's notes in the drawer's flow, styled as
  the same rows as the section list — not as a floating card, and with no
  backdrop, which would swallow the first click on the nav beneath it. See
  `docs/DECISIONS.md` #80.
- The first-visit intro hides the whole page behind `data-intro` on `<html>`.
  Never hide intro content in the HTML itself, and never remove one of its
  exits: any click/key/scroll/touch, the driver's own completion, and the 8s
  failsafe plus early pointer/key listeners in the gate script in
  `app/layout.tsx`. The gate must stay an inline `<head>` script (only that
  runs before the first paint) and must keep its pathname check. `INTRO_KEY` is
  duplicated between `components/Intro.tsx` and that script because the script
  runs before modules load — change both or every visitor becomes new again.
  Three details are load-bearing and were each a visible flash before review:
  the heading stays hidden until the driver adds `.tw`; the chrome is hidden
  and revealed BY NAME, never as `body > *:not(main)` (that also caught the
  drawer backdrop and the closed dialogs and faded a dark sheet over the page);
  and the character spans are never reassembled, because that reflows the
  title. Anything that manages its own visibility must be left to manage it.
  See `CLAUDE.md` and `docs/DECISIONS.md` #79.
- Keyboard shortcuts match through `shortcutKey()` (`lib/shortcut-key.ts`),
  never `e.key` directly: the site is bilingual and `e.key` is Cyrillic under a
  Ukrainian layout. `docs/DECISIONS.md` #77.
- Motion must answer interaction and disappear under reduced motion/print.
  Preserve the established `.press`, arrow-throw, stagger, and marker patterns.

## Verification

Use the smallest relevant check while iterating, then run the full required
checks before handing off a code or content change:

```bash
npm test
npm run build
```

- `npm test` uses Node's test runner over `lib/*.test.ts` **and
  `scripts/*.test.mjs`**, through `--import ./scripts/test-hooks.mjs` (which
  registers `scripts/test-resolve.mjs` for the `@/` alias and extensionless
  imports).
- `npm run build` first validates image notes and syncs vault assets, then
  statically generates every route. It is required because it catches broken
  content, imports, and static params that unit tests cannot.
- `npm run validate:image-notes` gates both `predev` and `prebuild`, so a broken
  image note fails `dev` and `build` before Next.js starts. Run it directly when
  iterating on an image note.
- For UI changes, also inspect the affected view in both languages, both system
  color schemes, relevant viewport sizes, keyboard/touch states, and reduced
  motion. If the available environment cannot perform a visual check, say so.
- To verify an arbitrary Tailwind class shipped, search built CSS for its escaped
  selector or inspect computed styles. A plain-text grep can produce a false
  negative.
- Report exactly which checks ran and any failures. Do not claim a check passed
  unless you ran it successfully.

## Planned / future — do not implement without a request

- Supabase-backed dynamic features such as views, reactions, or AMA. Content
  must remain in the static vault even if these are added later.
- Additional section types such as stack.
