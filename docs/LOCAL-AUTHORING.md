# Local authoring dock

The one exception to "no runtime fs access", and it lives outside the deployed site: `npm run dev` (`scripts/dev.mjs`) supervises Next plus a writer on `127.0.0.1` (`scripts/dev-editor.mjs`, `dev-editor-server.mjs`, `dev-editor-core.mjs`). Production has no rewrite, no writer, and `next.config.ts` aliases every dev component to a null/static replacement. Reasons and contract: DECISIONS #118, #119, #122. Replaced the 2026-08-29 change report; its verification log is in `git log`.

## Rules

- **Use `npm run dev`, never bare `next dev`**, and restart it after changing sidecar code — the sidecar does not hot-reload and an old process returns 404 for new endpoints.
- Available only when all three hold: development build, `window.location.hostname === "localhost"` exactly, sidecar running. The sidecar independently checks the exact supervisor origin, same-origin fetch metadata, and a random session token (`X-Vault-Editor-Token`); JSON only, bounded bodies, no CORS.
- **A URL never becomes a write path.** Sources come from `data-dev-vault-source` / `data-dev-body-field` markers on the page; the writer accepts only existing `.md` paths under `vault/`, rejects traversal/backslashes/NUL, resolves symlinks with realpath and rechecks containment. The Ukrainian path must be the primary's `.uk.md` sibling.
- **Prose is edited as source.** Clicking rendered prose swaps the article for a textarea with the exact Markdown; rendered HTML has no lossless inverse. Titles and descriptions are edited where they render. Generated lists, dates, counts, external players and other notes' rows are read-only. Attachments stay in Obsidian until their asset-copy/manifest/rollback transaction exists.
- **Saves are revision-checked and paired.** SHA-256 revisions of both files are checked before staging and again before replacement; frontmatter scalars are patched without reserialising unrelated YAML (comments, order, line endings, BOMs preserved); writes go through uniquely named siblings, fsync, atomic rename, with backups so a failed second replacement restores the first. A conflict keeps the browser draft and requires an explicit reload.
- **Keep the production audit clean**: no editor rewrite, route, token header, endpoint string or client implementation in the built JS, and no `+`, Page options or checkboxes in static HTML. Guarding a dynamic `import()` with `NODE_ENV` does NOT keep the client island out of the bundle — the webpack aliases do.
- Contextual writes refuse while the main editor has a dirty draft or a save in flight.

## What the dock does

Collapsed: a bottom-right pencil, nothing else. Expanded (`data-dev-tools` on `<html>`): a link to the same route on `siteUrl`, an `obsidian://open` link for the active language's file, language switch, Undo/Redo/Cancel/Save with one shared history across `title`, `title_uk`, `description`, `description_uk`, `body`, `body_uk`. Drafts survive soft navigation (kept with both revisions), prompt before same-origin navigation and on reload, and are hidden but retained when the dock closes. Cmd/Ctrl+S goes through `shortcutKey()`.

Contextual controls while expanded:

- **`+` beside a section title** (Posts, Music, People, Shelf, Projects): creates an EN/UK Draft pair from the section's server-read `type:`; bilingual title and description required; Shelf picks the medium folder; Music records artist, format, ENG/UA/RU shelf, optional genres and player URL. Rejects unsafe filenames and filename/route-slug collisions; creates the pair with rollback. "New # type" means a new category value, not a new section renderer.
- **Page options under an entry header**: Draft (reads `published: false` too, writes `draft: true`), categories (existing or new; a new one is valid at once and falls back to its English label until `lib/categories.ts` has a translation), Post series (`series`, one vault-wide `series_uk`, `part`). Changes are compared against RAW YAML keys.
- **Top-list rows** (movies, shows, games): stars become a half-star slider (arrows, Home/End, Delete clears) and rows drag into a manual order that writes consecutive `top_order:` across the participating notes; navigation is suppressed only past the drag threshold.
- **Now goals**: rendered boxes become checkboxes that flip one `[ ]`/`[x]` marker in `main.md` and `main.uk.md` together, guarded by the rendered English label.

Endpoints: `/page-document`, `/save-page`, `/document`, `/save`, `/create-entry`, `/toggle-now-goal`. Tests: `lib/dev-tools.test.ts`, `scripts/dev-editor-core.test.mjs`, `scripts/dev-editor-server.test.mjs`.

## Files

`components/DevTools.tsx` (controller), `DevToolsSlot.tsx`/`DevToolsDisabled.tsx`, `DevRatingEditor*.tsx`, `DevTopReorder*.tsx`, `DevCreateEntry*.tsx`, `DevEntryOptions*.tsx`, `DevNowGoalToggle*.tsx` (+ `SlotDisabled`), `useDevToolsExpanded.ts`, `lib/dev-editor-client.ts`, `lib/dev-tools.ts`; dock strings live in the separate `devUi` export in `lib/ui-strings.ts`.
