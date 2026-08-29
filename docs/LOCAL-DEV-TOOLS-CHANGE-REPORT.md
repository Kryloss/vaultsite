# Local Dev-Tools Change Report

Audience: Claude Code / the next agent working on Vaultsite
Date: 2026-08-28
Scope: localhost-only authoring controls for the static Obsidian-backed site

## Executive summary

The local development preview now includes a small authoring dock. It is
available only when all of the following are true:

- the site is running in development mode;
- the browser hostname is exactly localhost;
- the local editor sidecar is running through npm run dev.

The collapsed dock is a single pencil at the bottom-right. The public page and
the normal site chrome are unchanged while it is collapsed. Expanding it shows:

- a link to the configured public equivalent of the current route;
- an Open this file in Obsidian link for the active language;
- English/Ukrainian language switching;
- title and description fields;
- a draggable/keyboard-editable rating control on movie/show Top-list rows;
- Undo, Redo, Cancel, Save, and reload/retry actions;
- direct focus from the rendered title or description when the dock is open.

The first writable surface is deliberately limited to frontmatter metadata. It
edits the real Markdown source in vault/, while preserving the rest of the
file byte-for-byte wherever possible. Body editing and attachments remain in
Obsidian until source mapping and asset-transaction behavior are designed.

## User-facing behavior

### Collapsed state

components/DevTools.tsx renders one pencil button in the bottom-right corner.
The dock is absent outside exact localhost development, and the collapsed state
does not add a public-page button to the coordinate/breadcrumb bar.

The icon buttons are intentionally transparent: the shared dock surface remains,
but individual icons do not gain a colored background on hover.

### Expanded state

The dock expands horizontally into the tool bar and vertically into the editor
panel. The panel is right-aligned and capped for narrow/mobile viewports, with
dvh/safe-area handling and internal scrolling.

The editor displays the source path, dirty state, and four text fields:

    title
    title_uk
    description
    description_uk

The Top-list editor adds the numeric rating field separately:

    rating

Top-list rows can also be dragged while the dock is expanded. A drop persists
the complete visible order as consecutive zero-based `top_order` fields across
the participating movie/show notes, so later rating changes do not reshuffle a
manually arranged list. The sidecar stages the files together, rechecks every
source before replacement, and restores backups if a filesystem error interrupts
the final pass.

An absent Ukrainian metadata value remains absent until the user enters one;
the English value is shown as a placeholder rather than silently copied.

The public link uses lib/site-config.ts's canonical siteUrl (https://kryloss.com),
preserves the current pathname/query/hash, and normalizes the lang query for
the selected language. It does not invent or switch to a www origin.

The Obsidian link is returned by the sidecar as an encoded absolute-path URI.
When the Ukrainian sibling exists, the Ukrainian button targets that sibling;
otherwise it falls back to the primary English source. Both language metadata
sets live in the primary file's frontmatter.

On the unfiltered movie and show Top lists, the stars become an editable
half-star slider while the dock is expanded. Dragging across the stars chooses
0–5 in half-star increments; keyboard arrows move by half a star, Home/End jump
to 0 or 5, and Delete/Backspace clears the rating. Clicking elsewhere on the
row still opens the note. The same rows can be dragged into a manual order;
the complete order is written as `top_order` metadata, and then takes precedence
over rating/IMDb/date. The drag controller suppresses link navigation only
after movement crosses its threshold, so a normal click keeps opening the note.

## Client implementation

### Main components and helpers

- components/DevTools.tsx — thin client component for browser state, controls,
  route detection, loading, save actions, draft retention, and keyboard behavior.
- components/DevToolsSlot.tsx — development-only server slot; dynamically
  imports the client dock only in development.
- components/DevToolsDisabled.tsx — production null replacement.
- components/DevRatingEditor.tsx — localhost-only Top-list star slider.
- components/DevRatingEditorSlot.tsx — development import/production static-star fallback.
- components/DevRatingEditorDisabled.tsx — production null replacement for the
  rating editor import.
- components/DevTopReorder.tsx — localhost-only pointer drag controller for Top-list rows.
- components/DevTopReorderSlot.tsx — development import/production null slot.
- components/DevTopReorderDisabled.tsx — production null replacement for the
  reorder controller import.
- lib/dev-tools.ts — pure availability, URL, language-source, reducer, dirty,
  and change-set helpers.
- lib/dev-tools.test.ts — helper/reducer/URL tests.
- components/icons.tsx — Undo, Redo, Save, Obsidian, and Reload icons.
- lib/ui-strings.ts — local bilingual strings are kept in the separate
  devUi export, away from the public fixed-string object.

### Source markers

The server-rendered pages expose known authoring sources through dock-only data
attributes. They are present on:

- the home page;
- normal section pages;
- shelf medium/category pages (which point to the section main.md);
- entry pages;
- the rendered title/description fields used for direct click-to-focus.

The existing data-vault-source marker used by the public GitHub/open-note action
remains separate. The writer never derives a file path from the URL.

### Draft and navigation behavior

- Edits are grouped for practical Undo/Redo steps.
- Undo/Redo/Cancel only change browser state.
- Save after an Undo is still required before a reversal reaches disk.
- Dirty drafts are retained in a module-level map by source across soft
  navigation and restored when the source is revisited.
- Hard reloads use beforeunload protection.
- Ordinary same-origin anchor navigation prompts before discarding a dirty draft;
  modifier/new-tab/download/external links are not intercepted.
- A save in flight blocks ordinary navigation and validates both the current
  route generation and current DOM source marker before writing.
- Route changes clear the writable model immediately, then read the newly
  committed source marker on the next animation frame.
- Initial connection failures provide Retry; revision conflicts provide Reload.
- Cmd/Ctrl+S uses the repository's shortcutKey() helper, so it works under a
  Ukrainian keyboard layout as well as Latin layouts.

## Sidecar architecture

### Process model

package.json now runs:

    npm run dev -> node scripts/dev.mjs

scripts/dev.mjs supervises two children:

1. Next.js development server;
2. scripts/dev-editor.mjs, the loopback writer.

The sidecar listens on 127.0.0.1. Next adds the /__vault-editor/:path* rewrite
only when NODE_ENV is development. The editor refuses to start when explicitly
invoked with NODE_ENV=production.

The sidecar is a separate Node process and does not hot-reload when its script
changes. After adding or changing an editor endpoint, restart the complete
preview with `npm run dev`; an old process will otherwise return 404 for the
new endpoint and the browser will restore the pre-drag order after refresh.

### HTTP protections

scripts/dev-editor-server.mjs enforces:

- the supervisor-provided exact origin (http://localhost:<port> or HTTPS when
  requested);
- same-origin Origin/Referer metadata rules;
- a random in-memory session token sent in X-Vault-Editor-Token;
- exact application/json requests;
- bounded JSON request bodies;
- no CORS headers;
- supported methods only.

The integration tests cover exact localhost acceptance, numeric loopback and
foreign-origin rejection, missing/contradictory metadata, authentication,
malformed/oversized JSON, unsupported methods, and read/save/reorder behavior.

### Filesystem and save safety

scripts/dev-editor-core.mjs:

- accepts only existing POSIX .md paths beginning with vault/;
- rejects traversal, empty segments, backslashes, NUL bytes, and non-Markdown
  paths;
- resolves the repository, vault, candidate, and symlink target with realpath;
- verifies the final file remains inside vault/;
- reads the exact source and calculates a SHA-256 revision;
- patches only the supported top-level frontmatter keys;
- accepts the validated numeric rating field (0–5, half-star increments) and
  non-negative `top_order` positions for Top-list reordering;
- rejects duplicate editable keys, invalid YAML, empty English titles,
  multiline/overlong titles, and overlong descriptions;
- preserves unrelated YAML keys, comments, ordering, line endings, BOMs, and
  Markdown body text;
- writes through uniquely named siblings, fsyncs, rechecks revisions, and
  atomically renames metadata replacements into place; the multi-file reorder
  stages backups so an interrupted rename pass can be restored.

If the file changed in Obsidian after the browser loaded it, the sidecar returns
a revision conflict. The browser keeps the draft and requires an explicit
reload, so it never silently overwrites the newer source.

## Production isolation

next.config.ts contains three independent production safeguards:

1. the development rewrite is omitted outside development;
2. the production webpack configuration aliases DevTools to the null component;
3. DevToolsSlot returns null outside development.

The production build was inspected after generation. It contained no editor
rewrite, editor App Router route, editor token header, editor endpoint string,
or editor UI code in the generated JavaScript/server artifacts. The dormant
development CSS selectors remain harmlessly in the global stylesheet because
they have no mounted component in production.

The site remains static in production: no runtime filesystem reads, server
actions, database, or deployed write endpoint were added.

## Documentation updated

- AGENTS.md — local npm run dev sidecar exception and decision reference.
- CLAUDE.md — local authoring dock inventory, source-marker rule, and deferred
  body/attachment scope.
- docs/ARCHITECTURE.md — static-site exception for the loopback writer.
- docs/DECISIONS.md — decisions #118–119, including the security model, narrow
  metadata/rating scope, revision handling, and Obsidian handoff.

## Verification

Final checks performed in the active checkout:

- npm test — 218 passed, 0 failed;
- npx tsc --noEmit — passed;
- git diff --check — passed.

The isolated feature worktree also completed:

- npm test — 194 passed, 0 failed at that worktree's final feature state;
- NEXT_TELEMETRY_DISABLED=1 npm run build — production build passed,
  generating 204 static pages;
- production artifact scan — no editor endpoint/token/UI code in generated
  JavaScript/server artifacts and no production rewrite.

Browser verification covered exact localhost, rejection of 127.0.0.1, the
collapsed/expanded states, route-preserving public links, active-language
Obsidian links, direct title focus, Undo/Redo/Cancel, dark mode, and narrow
mobile widths. The local drag interaction was exercised with the writer
intentionally unavailable and correctly restored its order after the failed
request; no owner vault file was modified during visual verification. The live
writer was then checked after restart: `/__vault-editor/reorder` returned its
expected validation response instead of 404. Light-mode emulation was not
available in that browser session; CSS uses the existing light/dark tokens.

## Known limits and follow-up

1. Body editing is not implemented. Rendered HTML has no faithful source map;
   editing it directly would risk destroying Markdown structure, wiki links,
   embeds, callouts, tables, and bilingual pairing.
2. Attachments are not implemented. A safe attachment flow needs coordinated
   asset copy, Markdown update, image-manifest regeneration, cache invalidation,
   collision handling, and rollback.
3. The Obsidian button is the intended handoff for body and attachment work.
4. Always use npm run dev, not bare next dev, or the sidecar/rewrite will not
   be available.
5. The checkout may contain unrelated in-progress edits. At handoff, preserve
   these files and do not reset or restore them: lib/previews.ts, lib/vault.ts,
   and the untracked lib/vault.test.ts.

## Handoff recommendation

Treat docs/DECISIONS.md #118 and this report as the implementation contract.
If extending the dock, keep the exact-hostname gate, sidecar separation,
source-marker boundary, revision check, atomic write, bilingual UI, and
production webpack replacement intact. Revisit body editing or attachments only
after their source-map/transaction designs are written down and tested.
